# RAG Chat di Cloudflare — Workspace Belajar

Workspace belajar dari nol untuk membangun chatbot RAG (retrieval-augmented generation) di atas dokumen pribadi, dideploy di Cloudflare — dibangun manual dengan Workers, Vectorize, dan Workers AI.

Bukan tutorial salin-tempel: tiap sesi punya satu konsep, satu latihan konkret, dan satu sumber utama yang bisa ditelusuri.

## Struktur

| Path | Isi |
|------|-----|
| `MISSION.md` | Tujuan dan batas cakupan belajar |
| `lessons/` | Materi per sesi (HTML, bisa dibuka di browser) |
| `reference/` | Cheat sheet ringkas, dirancang untuk dicetak |
| `assets/` | Stylesheet dan komponen kuis bersama |
| `eval/` | Set pertanyaan uji untuk mengukur kualitas jawaban |
| `RESOURCES.md` | Sumber terkurasi (dokumentasi Cloudflare, riset, komunitas) |
| `GLOSSARY.md` | Kosakata kanonik workspace |
| `learning-records/` | Catatan insight dan prior knowledge |
| `NOTES.md` | Preferensi belajar dan keputusan kurikulum |

## Mulai dari

Buka `lessons/0001-mental-model-rag.html`, atau langsung ke `reference/rag-pipeline-map.html` untuk peta satu halaman.

## Status

Sesi 1 dari 7 — model mental dan peta pipeline.

Rencana: setup Worker → chunking & ingestion → retrieval → generation + sitasi → evaluasi & biaya → produksi.

## Catatan versi

Materi disusun November 2026. Angka batas dan harga mengacu pada dokumentasi Cloudflare saat itu; `bge-m3` dipakai alih-alih `bge-base-en-v1.5` karena korpus berbahasa Indonesia.

## Sumber utama

- [Cloudflare — Build a RAG AI](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai/)
- [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/)
- [Anthropic — Contextual Retrieval](https://www.anthropic.com/research/contextual-retrieval)
