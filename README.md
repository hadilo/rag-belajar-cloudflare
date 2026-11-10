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

Versi web: <https://hadilo.github.io/rag-belajar-cloudflare/>. Atau langsung buka `lessons/0001-mental-model-rag.html`. Untuk peta satu halaman: `reference/rag-pipeline-map.html`.

## Status

Tujuh sesi selesai.

| Sesi | Topik | Hasil |
|------|-------|-------|
| 1 | Model mental | Peta pipeline + set pertanyaan uji |
| 2 | Panggilan pertama | Worker ter-deploy yang mengembalikan vektor |
| 3 | Ingestion | Korpus terindeks, idempotent |
| 4 | Retrieval | Endpoint `/search` yang bisa diaudit |
| 5 | Generation | Chat streaming dengan sitasi |
| 6 | Evaluasi & biaya | Baseline terukur + biaya per pertanyaan |
| 7 | Produksi | Checklist + keputusan bangun vs managed |

Referensi: `reference/rag-pipeline-map.html` (cheat sheet) dan `reference/code-cookbook.html` (semua snippet).

## Catatan versi

Materi disusun November 2026. Angka batas dan harga mengacu pada dokumentasi Cloudflare saat itu; `bge-m3` dipakai alih-alih `bge-base-en-v1.5` karena korpus berbahasa Indonesia.

## Sumber utama

- [Cloudflare — Build a RAG AI](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai/)
- [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/)
- [Anthropic — Contextual Retrieval](https://www.anthropic.com/research/contextual-retrieval)
