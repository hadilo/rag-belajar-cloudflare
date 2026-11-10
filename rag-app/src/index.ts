import { ingestDoc, ObjectNotFoundError } from "./ingest";
import { embed } from "./ai";
import { search, rrf, lexicalRank } from "./search";
import { answer, streamAnswer } from "./chat";

const SEED: Record<string, string> = {
	"catatan/rag.md": `# Catatan RAG

RAG adalah pola di mana dokumen diambil dulu berdasarkan kemiripan makna, lalu potongan yang terambil dimasukkan ke prompt sebagai konteks.

Chunk adalah potongan teks berukuran terbatas yang di-embed dan disimpan sebagai satu unit retrieval. Ukuran chunk yang dipakai di kursus ini sekitar 1.200 karakter, kira-kira 300 sampai 400 token.

Chunk overlap adalah bagian teks yang sengaja diulang di antara dua chunk berdekatan. Overlap menjaga kalimat yang terpotong di batas chunk tetap utuh di salah satunya. Overlap yang disarankan 10 sampai 20 persen.

Embedding adalah vektor angka yang mewakili makna sebuah teks. Teks yang maknanya mirip menghasilkan vektor yang berdekatan.`,
	"catatan/cloudflare.md": `# Catatan Cloudflare

Model embedding bge-m3 menghasilkan vektor 1024 dimensi dan mendukung lebih dari 100 bahasa. Biayanya 0,012 dolar per juta token input.

Vectorize adalah vector database Cloudflare. Dimensi indeks dikunci saat indeks dibuat dan tidak bisa diubah. Maksimum topK adalah 50 bila metadata diminta, dan 100 tanpa metadata.

Workers AI memberi 10.000 neuron gratis per hari. Model generasi yang dipakai di kursus ini adalah qwen3-30b-a3b-fp8.

D1 menyimpan teks chunk dan metadata. R2 menyimpan file asli sebagai sumber kebenaran.`,
	"catatan/kerja.md": `# Catatan kerja

Rapat mingguan dipindah ke hari Selasa pukul 10.00. Agenda minggu ini membahas rencana anggaran kuartal depan dan jadwal libur tim.

	Daftar belanja kantor: kopi, teh, gula, dan gelas kertas.`,
	"catatan/panjang.md": `# Strategi chunking

Chunking menentukan seberapa baik retrieval bekerja. Potongan yang terlalu kecil kehilangan konteks, sedangkan potongan yang terlalu besar membanjiri prompt dan membuat model mengabaikan bagian tengah konteks. Ukuran awal yang aman adalah 300 sampai 800 token, dengan overlap 10 sampai 20 persen.

Recursive chunking memotong teks pada batas alami terlebih dahulu, yaitu paragraf, lalu kalimat, baru kemudian memotong paksa bila masih terlalu panjang. Pendekatan ini menjaga gagasan tetap utuh di dalam satu chunk. Sebaliknya, pemotongan tetap berdasarkan jumlah karakter akan memotong kalimat di tengah dan menghasilkan chunk yang tidak bisa dipahami sendiri.

Overlap berfungsi sebagai jaring pengaman. Kalimat yang terpotong di akhir satu chunk akan muncul utuh di awal chunk berikutnya, sehingga retrieval punya dua kesempatan untuk menemukannya. Harga dari overlap adalah teks yang sama di-embed lebih dari sekali, sehingga biaya ingestion naik. Karena itu angka 10 sampai 20 persen lebih baik daripada 50 persen.

Contextual retrieval menambahkan satu langkah: sebelum di-embed, setiap chunk diberi ringkasan konteks tentang asal dan isinya. Penelitian Anthropic menunjukkan teknik ini memotong kegagalan retrieval sekitar 49 persen, dan sekitar 67 persen bila digabung dengan hybrid search dan reranking.

Metadata pada setiap chunk sebaiknya memuat sumber, nomor chunk, dan tanggal. Metadata inilah yang nanti dipakai untuk menyaring hasil per dokumen atau per pengguna, dan untuk menampilkan sitasi di jawaban akhir. Tanpa metadata, kamu hanya punya teks tanpa asal-usul.`,
};

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		try {
			if (path === "/" && request.method === "GET") {
				return json({
					ok: true,
					routes: ["GET /health", "POST /seed", "POST /ingest", "GET /search?q=", "POST /chat"],
				});
			}

			if (path === "/health" && request.method === "GET") {
				const { results } = await env.DB.prepare(
					"SELECT source, COUNT(*) AS n FROM chunks GROUP BY source",
				).all<{ source: string; n: number }>();

				const total = results.reduce((a, r) => a + r.n, 0);
				return json({ ok: true, chunks: total, bySource: results });
			}

			if (path === "/seed" && request.method === "POST") {
				for (const [key, body] of Object.entries(SEED)) {
					await env.DOCS.put(key, body);
				}
				return json({ seeded: Object.keys(SEED) });
			}

			if (path === "/ingest" && request.method === "POST") {
				const body = (await request.json().catch(() => ({}))) as {
					key?: string;
					all?: boolean;
				};

				if (body.all) {
					const list = await env.DOCS.list();
					const results = [];
					for (const obj of list.objects) {
						results.push(await ingestDoc(env, obj.key));
					}
					return json({ results });
				}

				if (!body.key) return json({ error: "kirim { key } atau { all: true }" }, 400);

				return json(await ingestDoc(env, body.key));
			}

			if (path === "/debug/upsert" && request.method === "GET") {
				const id = url.searchParams.get("id") ?? "debug-1";
				const [vector] = await embed(env, ["tes vektor"]);
				const res = await env.INDEX.upsert([{ id, values: vector, metadata: { source: "debug" } }]);
				return json({ id, dimensions: vector.length, res });
			}

			if (path === "/debug/rrf" && request.method === "GET") {
				const q = url.searchParams.get("q");
				if (!q) return json({ error: "parameter q wajib" }, 400);

				const result = await search(env, q);
				const vectorIds = result.hits.map((h) => h.id);
				const lexicalIds = lexicalRank(q, result.hits);
				return json({ q, vectorIds, lexicalIds, fused: rrf([vectorIds, lexicalIds]) });
			}

			if (path === "/search" && request.method === "GET") {
				const q = url.searchParams.get("q");
				if (!q) return json({ error: "parameter q wajib" }, 400);

				const source = url.searchParams.get("source") ?? undefined;
				const result = await search(env, q, 20, 6, { source });
				return json({
					question: q,
					filter: source ? { source } : null,
					...result,
					hits: result.hits.map((h) => ({
						id: h.id,
						source: h.source,
						chunk_index: h.chunk_index,
						score: Number(h.score.toFixed(4)),
						rerankScore:
							h.rerankScore !== undefined ? Number(h.rerankScore.toFixed(4)) : null,
						preview: h.text.slice(0, 120),
					})),
				});
			}

			if (path === "/chat" && request.method === "POST") {
				const { question } = (await request.json()) as { question?: string };
				if (!question) return json({ error: "question wajib" }, 400);

				const { hits } = await search(env, question);
				const sources = [...new Set(hits.map((h) => h.source))];

				if (url.searchParams.get("format") === "json") {
					const result = await answer(env, question, hits);
					return json({ question, ...result });
				}

				const stream = await streamAnswer(env, question, hits);

				return new Response(stream as ReadableStream, {
					headers: {
						"content-type": "text/event-stream",
						"cache-control": "no-cache",
						"x-sources": sources.join(","),
					},
				});
			}

			return json({ error: "not found", path }, 404);
		} catch (err) {
			if (err instanceof ObjectNotFoundError) {
				return json({ error: err.message }, 404);
			}
			return json({ error: String(err) }, 500);
		}
	},
} satisfies ExportedHandler<Env>;
