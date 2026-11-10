import { embed } from "./ai";
import { MAX_FILE_BYTES } from "./limits";

export class ObjectNotFoundError extends Error {
	constructor(key: string) {
		super(`Tidak ada objek: ${key}`);
		this.name = "ObjectNotFoundError";
	}
}

export class PayloadTooLargeError extends Error {
	constructor(key: string) {
		super(`File melebihi batas: ${key}`);
		this.name = "PayloadTooLargeError";
	}
}

export async function extract(env: Env, user: string, key: string): Promise<string> {
	const storageKey = `users/${user}/${key}`;
	const obj = await env.DOCS.get(storageKey);
	if (!obj) throw new ObjectNotFoundError(key);
	if (obj.size > MAX_FILE_BYTES) throw new PayloadTooLargeError(key);

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

export async function ingestDoc(env: Env, user: string, key: string) {
	const text = await extract(env, user, key);
	const chunks = chunkText(text);
	const idFor = (index: number) => `${user}:${key}#${index}`;

	let embedded = 0;
	let skipped = 0;

	for (let i = 0; i < chunks.length; i += 20) {
		const batch = chunks.slice(i, i + 20);
		const hashes = await Promise.all(batch.map(sha256));
		const ids = batch.map((_, j) => idFor(i + j));

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

		const vectors = await embed(env, todo.map((t) => t.text));

		await env.INDEX.upsert(
			todo.map((t, j) => ({
				id: t.id,
				values: vectors[j],
				namespace: user,
				metadata: { source: key, chunk: t.chunk, owner: user },
			})),
		);

		await env.DB.batch(
			todo.map((t) =>
				env.DB.prepare(
					`INSERT OR REPLACE INTO chunks
					 (id, owner, source, chunk_index, text, hash, created_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				).bind(t.id, user, key, t.chunk, t.text, t.hash, Date.now()),
			),
		);

		embedded += todo.length;
	}

	// Rekonsiliasi: chunk yang tidak lagi dihasilkan dokumen ini harus hilang
	// dari D1 dan Vectorize, bukan hanya dibiarkan sebagai yatim.
	const expected = new Set(chunks.map((_, i) => idFor(i)));
	const { results: existing } = await env.DB.prepare(
		"SELECT id FROM chunks WHERE owner = ? AND source = ?",
	)
		.bind(user, key)
		.all<{ id: string }>();

	const orphans = existing.filter((r) => !expected.has(r.id)).map((r) => r.id);

	if (orphans.length) {
		await env.DB.batch(
			orphans.map((id) => env.DB.prepare("DELETE FROM chunks WHERE id = ?").bind(id)),
		);
		await env.INDEX.deleteByIds(orphans);
	}

	return { key, chunks: chunks.length, embedded, skipped, deleted: orphans.length };
}
