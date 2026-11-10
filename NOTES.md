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
- Ingestion dibuat idempotent sejak awal (ID deterministik dari hash), bukan ditambal belakangan.
- Evaluasi tidak ditunda ke akhir: golden set dibuat di sesi 1.

## Istilah yang dipakai konsisten
- "chunk" (bukan "potongan teks"), "index-time" / "query-time", "retrieval" (bukan "pencarian"), "generation".
- "gagal retrieval" untuk kasus chunk yang benar tidak masuk top-K.

## Hal yang mudah salah (diingatkan di sesi terkait)
- Dimensi indeks Vectorize tidak bisa diubah setelah dibuat → ganti model embedding = buat indeks baru.
- Metadata filter butuh metadata index dibuat *sebelum* vektor di-upsert.
- `topK` maksimum 50 kalau minta metadata/values.
- Workers Free CPU 10 ms → pekerjaan ingestion harus async (Workflow/Queue), bukan di request handler.
- Draft: materi dibuat Nov 2026; AI Search baru mulai ditagih 1 Des 2026.
