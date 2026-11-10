# Notes

## Preferensi belajar
- Bahasa: Indonesia; istilah teknis dibiarkan Inggris (embedding, chunk, retrieval, reranker).
- Latar belakang: TypeScript/JS lancar, tidak perlu menjelaskan dasar bahasa/web.
- Format: sesi pendek, satu konsep per sesi, tiap sesi harus punya satu hasil konkret.
- Jalur: bangun manual (Workers + Vectorize + Workers AI). Managed (AI Search) hanya sebagai pembanding dan bahan keputusan nanti.
- Tiap lesson: HTML, indah, bisa dicetak, ada kuis dengan feedback langsung.

## Keputusan desain kurikulum
- Model embedding: `@cf/baai/bge-m3` (1024 dim, multibahasa) — bukan `bge-base-en-v1.5` (768 dim, Inggris) yang dipakai tutorial resmi. Alasan: dokumen user berbahasa Indonesia.
- Metrik: cosine.
- Dokumen sumber: dokumen pribadi (markdown/PDF), disimpan di R2 sebagai sumber kebenaran; teks chunk di D1.
- Ingestion dibuat idempotent sejak awal: ID `source#index` (stabil, agar upsert menggantikan) + hash isi di D1 (agar chunk tak berubah dilewati).
- Evaluasi tidak ditunda ke akhir: golden set dibuat di sesi 1.
- Urutan kurikulum: retrieval (sesi 4) sebelum generation (sesi 5), karena mayoritas kegagalan RAG ada di retrieval.
- Hybrid search diajarkan sebagai RRF (rank-based, tidak perlu normalisasi skor), dengan FTS5 sebagai opsi yang harus diuji dulu — bukan diklaim pasti tersedia.

## Status kurikulum
Ketujuh sesi selesai (Nov 2026): 0001 model mental, 0002 embedding, 0003 ingestion, 0004 retrieval, 0005 generation, 0006 evaluasi/biaya, 0007 produksi. Referensi: cheat sheet + cookbook kode.

## Istilah yang dipakai konsisten
- "chunk" (bukan "potongan teks"), "index-time" / "query-time", "retrieval" (bukan "pencarian"), "generation".
- "gagal retrieval" untuk kasus chunk yang benar tidak masuk top-K.

## Hal yang mudah salah (diingatkan di sesi terkait)
- Dimensi indeks Vectorize tidak bisa diubah setelah dibuat → ganti model embedding = buat indeks baru.
- Metadata filter butuh metadata index dibuat *sebelum* vektor di-upsert.
- `topK` maksimum 50 kalau minta metadata/values.
- Workers Free CPU 10 ms → pekerjaan ingestion harus async (Workflow/Queue), bukan di request handler.
- Draft: materi dibuat Nov 2026; AI Search baru mulai ditagih 1 Des 2026.
