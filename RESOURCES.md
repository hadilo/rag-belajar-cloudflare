# RAG di Cloudflare — Resources

Sumber yang dipakai untuk menyusun materi. Semua klaim teknis di lesson harus bisa ditelusuri ke sini.

## Knowledge

### Cloudflare (sumber primer, paling otoritatif untuk platform)

- [Tutorial: Build a RAG AI (Workers AI + Vectorize + D1 + Workflows)](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai/)
  Tutorial resmi end-to-end. Dipakai untuk: alur ingestion, Workflow, chunking, prompt RAG. Catatan: contohnya memakai `bge-base-en-v1.5` (768 dim, Inggris) — kita ganti ke `bge-m3` karena dokumen berbahasa Indonesia.
- [Vectorize API (binding, upsert, query, topK, returnMetadata)](https://developers.cloudflare.com/vectorize/reference/client-api/)
  Referensi API. Dipakai untuk: signature `query()`, batas topK, `returnMetadata: 'indexed' | 'all'`.
- [Vectorize: Metadata filtering](https://developers.cloudflare.com/vectorize/reference/metadata-filtering/)
  Sintaks filter (`$eq`, `$in`, `$gte`, dst) dan aturan metadata index. Dipakai untuk: filter sumber/tanggal, isolasi per-user.
- [Vectorize: Limits](https://developers.cloudflare.com/vectorize/platform/limits/)
  Angka pasti: 1536 dim maks, topK 50 dengan metadata, 10 KiB metadata/vektor, 10 metadata index, 20 juta vektor/indeks, 1000 upsert/batch.
- [Vectorize + Workers AI (embeddings walkthrough)](https://developers.cloudflare.com/vectorize/get-started/embeddings/)
  Versi paling ringkas untuk loop insert→query. Dipakai di sesi 2–3.
- [Workers AI: Models](https://developers.cloudflare.com/workers-ai/models/)
  Katalog model. Yang relevan: `@cf/baai/bge-m3` (embedding multibahasa), `@cf/baai/bge-reranker-base` (rerank), `@cf/qwen/qwen3-30b-a3b-fp8`, `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, `@cf/ibm-granite/granite-4.0-h-micro`.
- [Workers AI: Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
  Harga per model dalam neuron. Dipakai untuk hitungan biaya: bge-m3 $0.012/M token input, reranker $0.003/M, LLM bervariasi.
- [Workers AI: Rate limits](https://developers.cloudflare.com/workers-ai/platform/limits/)
  Embedding 3000 req/menit, text generation 300 req/menit.
- [Workers: Limits](https://developers.cloudflare.com/workers/platform/limits/)
  CPU time (10 ms free / 30 s default paid), subrequest, memori 128 MB, durasi HTTP tak dibatasi. Ini yang menentukan pekerjaan mana harus async.
- [AI Search (dulu AutoRAG)](https://developers.cloudflare.com/ai-search/)
  Versi managed: indexing otomatis, hybrid search default, metadata filter, MCP endpoint. Dipakai sebagai pembanding "kapan berhenti membangun sendiri".
- [AI Search: Limits & pricing](https://developers.cloudflare.com/ai-search/platform/limits-pricing/)
  5 juta token ingestion + 1000 query/bulan termasuk; billing mulai 1 Des 2026. Berguna untuk perbandingan biaya.
- [AI Search: Chunking](https://developers.cloudflare.com/ai-search/configuration/indexing/chunking/)
  Penjelasan recursive chunking dan trade-off chunk size/overlap (0–30%). Bagus sebagai rujukan konsep walau kita bangun manual.
- [AI Gateway](https://developers.cloudflare.com/ai-gateway/)
  Caching, rate limiting, logging, fallback. Untuk sesi produksi.
- [Reference architecture: RAG di Cloudflare](https://developers.cloudflare.com/reference-architecture/diagrams/ai/ai-rag/)
  Diagram arsitektur resmi. Berguna untuk membandingkan peta kita dengan versi "resmi".

### Umum (praktik RAG yang tidak spesifik Cloudflare)

- [Anthropic: Contextual Retrieval](https://www.anthropic.com/research/contextual-retrieval)
  Bukti angka: contextual embeddings + contextual BM25 memotong failed retrieval ~49%, dan ~67% dengan reranking. Dipakai di sesi chunking & retrieval.
- [Anthropic Cookbook: Contextual embeddings](https://platform.claude.com/cookbook/capabilities-contextual-embeddings-guide)
  Implementasi konkret (prepend 50–100 token konteks per chunk). Bisa diadaptasi dengan model murah.
- [Hugging Face: chunk visualizer](https://huggingface.co/spaces/m-ric/chunk_visualizer)
  Alat untuk melihat efek chunk size/overlap pada teks nyata. Dipakai saat latihan chunking.
- [Paper: Retrieval-Augmented Generation (Lewis et al., 2020)](https://arxiv.org/abs/2005.11401)
  Definisi asli RAG. Dibaca sekali untuk memahami kenapa arsitekturnya dipisah jadi retriever + generator.

## Wisdom (Communities)

- [Cloudflare Developers Discord](https://discord.cloudflare.com)
  Channel `#vectorize`, `#workers-ai`, `#ai-gateway`. Staf Cloudflare aktif. Tempat terbaik untuk bertanya soal limit/error spesifik platform.
- [Cloudflare Community Forum](https://community.cloudflare.com/)
  Untuk masalah yang butuh jawaban yang bisa dicari orang lain (bukan chat cepat).
- [GitHub: cloudflare/workers-sdk (issues)](https://github.com/cloudflare/workers-sdk/issues)
  Untuk bug Wrangler/Vectorize. Selalu sertakan versi wrangler dan `wrangler.jsonc` yang disanitasi.
- Lokal: tidak ada meetup tetap — belum diprioritaskan.

## Gaps

- Belum ada sumber otoritatif khusus "RAG Bahasa Indonesia" (stemming, tokenizer, evaluasi multibahasa). Saat ini mengandalkan klaim multibahasa bge-m3 dan pengujian sendiri.
- Belum ada benchmark publik untuk kualitas reranker `bge-reranker-base` pada teks Indonesia — perlu diukur sendiri di sesi evaluasi.
