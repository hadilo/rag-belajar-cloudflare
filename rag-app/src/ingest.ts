export async function extract(env: Env, key: string): Promise<string> {
	const obj = await env.DOCS.get(key);
	if (!obj) throw new Error(`Tidak ada objek: ${key}`);

	// Markdown dan teks polos dibaca apa adanya; format lain lewat toMarkdown.
	if (/\.(md|txt|markdown)$/i.test(key)) {
		return await obj.text();
	}

	const [result] = await env.AI.toMarkdown([
		{
			name: key,
			blob: new Blob([await obj.arrayBuffer()]),
		},
	]);

	if (!result) throw new Error(`Konversi gagal: ${key}`);
	if (result.format === "error") throw new Error(result.error);
	return result.data;
}

export function chunkText(text: string, size = 1200, overlap = 200): string[] {
	const paragraphs = text
		.split(/\n{2,}/)
		.map((p) => p.trim())
		.filter(Boolean);

	const chunks: string[] = [];
	let buf = "";

	for (const p of paragraphs) {
		if (buf.length > 0 && buf.length + p.length + 2 > size) {
			chunks.push(buf.trim());
			buf = buf.slice(Math.max(0, buf.length - overlap)).trim() + "\n\n";
		}
		buf += p + "\n\n";
	}
	if (buf.trim()) chunks.push(buf.trim());
	return chunks;
}

export async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return [...new Uint8Array(digest)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

type Todo = { id: string; chunk: number; text: string; hash: string };

export async function ingestDoc(env: Env, key: string) {
	const text = await extract(env, key);
	const chunks = chunkText(text);

	let embedded = 0;
	let skipped = 0;

	for (let i = 0; i < chunks.length; i += 20) {
		const batch = chunks.slice(i, i + 20);
		const hashes = await Promise.all(batch.map(sha256));
		const ids = batch.map((_, j) => `${key}#${i + j}`);

		const existing = await env.DB.prepare(
			`SELECT id, hash FROM chunks WHERE id IN (${ids.map(() => "?").join(",")})`,
		)
			.bind(...ids)
			.all<{ id: string; hash: string }>();

		const hashById = new Map(existing.results.map((r) => [r.id, r.hash]));
		const todo: Todo[] = [];

		batch.forEach((t, j) => {
			const id = ids[j];
			if (hashById.get(id) === hashes[j]) {
				skipped += 1;
				return;
			}
			todo.push({ id, chunk: i + j, text: t, hash: hashes[j] });
		});

		if (!todo.length) continue;

		const { data } = await env.AI.run("@cf/baai/bge-m3", {
			text: todo.map((t) => t.text),
		});

		await env.INDEX.upsert(
			todo.map((t, j) => ({
				id: t.id,
				values: data[j],
				metadata: { source: key, chunk: t.chunk },
			})),
		);

		await env.DB.batch(
			todo.map((t) =>
				env.DB.prepare(
					`INSERT OR REPLACE INTO chunks
					 (id, source, chunk_index, text, hash, created_at)
					 VALUES (?, ?, ?, ?, ?, ?)`,
				).bind(t.id, key, t.chunk, t.text, t.hash, Date.now()),
			),
		);

		embedded += todo.length;
	}

	return { key, chunks: chunks.length, embedded, skipped };
}
