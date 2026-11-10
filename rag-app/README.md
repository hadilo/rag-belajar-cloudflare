# rag-app

Chatbot RAG yang berjalan di Cloudflare Workers: menjawab pertanyaan dari dokumen sendiri, dengan sitasi ke file sumber.

Implementasi yang bisa dijalankan dari kursus `RAG di Cloudflare` (sesi 2–5). Tujuannya membuktikan materi, bukan menggantikan penjelasannya.

```
R2 ──► chunk ──► bge-m3 ──► Vectorize
                                 │
pertanyaan ──► bge-m3 ──► query ─┘──► rerank ──► prompt ──► LLM ──► jawaban + sitasi
```

**Status:** terverifikasi end-to-end pada 10 November 2026 — 5 chunk dari 4 dokumen, ingest idempoten, filter metadata, rerank, jawaban bersitasi, penolakan di luar korpus, dan streaming SSE. 4 test API hijau (`npm test`).

---

## Prasyarat

- Node.js 20+ dan npm
- Akun Cloudflare dengan Workers AI aktif
- Login Wrangler: `npx wrangler login`

## Quickstart

```bash
npm install
npx wrangler d1 execute rag --local --file=schema.sql
npx wrangler dev --port 8787
```

Di terminal lain:

```bash
# 1. taruh dokumen contoh ke R2 lokal
curl -X POST localhost:8787/seed

# 2. chunk + embed + indeks
curl -X POST localhost:8787/ingest \
  -H 'content-type: application/json' -d '{"all":true}'

# 3. tanya
curl -s -X POST 'localhost:8787/chat?format=json' \
  -H 'content-type: application/json' \
  -d '{"question":"Berapa dimensi bge-m3?"}'
```

Keluaran yang diharapkan:

```json
{
  "answer": "Model bge-m3 menghasilkan vektor 1024 dimensi [catatan/cloudflare.md].",
  "sources": ["catatan/cloudflare.md", "catatan/rag.md"],
  "cited": ["catatan/cloudflare.md"],
  "invalid": [],
  "hasCitation": true
}
```

> Query pertama setelah ingest bisa mengembalikan 0 hasil. Vectorize butuh 40–60 detik untuk memproses mutasi. Lihat [Troubleshooting](#troubleshooting).

## Endpoint

| Method | Path | Keterangan |
|---|---|---|
| `GET` | `/` | Daftar route |
| `GET` | `/health` | Jumlah chunk per dokumen |
| `POST` | `/seed` | Menulis 4 dokumen contoh ke R2 (`{ key: isi }`) |
| `POST` | `/ingest` | `{"all":true}` atau `{"key":"catatan/x.md"}` |
| `GET` | `/search?q=` | Retrieval + rerank; tambahkan `&source=` untuk filter metadata |
| `POST` | `/chat` | Streaming SSE; tambahkan `?format=json` untuk jawaban JSON |
| `GET` | `/debug/upsert?id=` | Uji upsert satu vektor (lokal) |
| `GET` | `/debug/rrf?q=` | Uji fusi peringkat vektor + leksikal |

Contoh:

```bash
# lihat kenapa sebuah jawaban diambil
curl -s -G localhost:8787/search --data-urlencode "q=apa itu recursive chunking"

# batasi ke satu dokumen
curl -s -G localhost:8787/search \
  --data-urlencode "q=chunk overlap" \
  --data-urlencode "source=catatan/rag.md"

# streaming
curl -N -X POST localhost:8787/chat \
  -H 'content-type: application/json' \
  -d '{"question":"Apa itu chunk overlap?"}'
```

## Konfigurasi

| Binding | Resource | Mode | Alasan |
|---|---|---|---|
| `AI` | Workers AI | remote | Model hanya berjalan di jaringan Cloudflare |
| `DB` | D1 | local | SQLite lokal, cukup untuk demo |
| `DOCS` | R2 | local | R2 belum diaktifkan di akun ini |
| `INDEX` | Vectorize | remote | Vectorize tidak didukung di mode lokal |

Karena `INDEX` remote, indeks harus ada di akun:

```bash
npx wrangler vectorize create rag-index --dimensions=1024 --metric=cosine
npx wrangler vectorize create-metadata-index rag-index --property-name=source --type=string
```

Hapus setelah selesai: `npx wrangler vectorize delete rag-index`.

Untuk produksi, aktifkan R2 di dashboard lalu ubah `DOCS` menjadi remote, dan ganti `database_id` placeholder di `wrangler.jsonc` dengan ID D1 hasil `npx wrangler d1 create rag`.

## Struktur

```
rag-app/
├── src/
│   ├── index.ts      # routing + seed
│   ├── ingest.ts     # extract, chunkText, sha256, ingestDoc
│   ├── search.ts     # embed, query, join D1, rerank, rrf
│   ├── chat.ts       # prompt, generation, verifikasi sitasi
│   └── prompt.ts     # konstanta SYSTEM
├── schema.sql
├── wrangler.jsonc
└── AGENTS.md         # aturan untuk agen coding
```

## Cara kerja

**Index-time.** `extract` membaca file dari R2 (`.md`/`.txt` langsung, format lain lewat `toMarkdown`). `chunkText` memotong per paragraf, 1.200 karakter dengan overlap 200. Setiap chunk di-embed dengan `bge-m3` (1.024 dimensi) lalu di-upsert ke Vectorize dengan ID `source#index` dan metadata `{ source, chunk }`. Hash isi disimpan di D1 agar run berikutnya melewati chunk yang tidak berubah.

**Query-time.** Pertanyaan di-embed dengan model yang sama, lalu Vectorize mengembalikan 20 kandidat. Teksnya diambil dari D1 dan diurutkan ulang sesuai skor (SQL `IN` tidak menjaga urutan). Reranker `bge-reranker-base` menyempitkan ke 6 chunk. Prompt memuat konteks berlabel sumber; jawaban diperiksa sitasinya terhadap daftar sumber yang benar-benar terambil.

## Operasi

**Tambah dokumen**

```bash
npx wrangler r2 object put rag-docs/catatan/buku.md --file ./buku.md --local
curl -X POST localhost:8787/ingest -H 'content-type: application/json' -d '{"all":true}'
```

Ingest bersifat rekonsiliasi: chunk yang tidak lagi dihasilkan dokumen (karena isinya menyusut atau chunking berubah) dihapus dari D1 dan Vectorize. Respons menyertakan `deleted` berisi jumlah chunk yang dibersihkan.

**Uji dan typecheck**

```bash
npm test        # butuh dev server berjalan di localhost:8787
npm run typecheck
```

**Mulai bersih**

```bash
rm -rf .wrangler/state
npx wrangler d1 execute rag --local --file=schema.sql
```

**Ganti model embedding**

Dimensi terkunci, jadi ini migrasi: buat indeks baru → backfill seluruh korpus → tukar `index_name` → hapus indeks lama. Jangan mencampur dua model dalam satu indeks.

## Troubleshooting

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| `/search` mengembalikan 0 hasil padahal ingest sukses | Mutasi Vectorize belum diproses | Tunggu 40–60 detik, ulangi |
| Filter `source=` selalu kosong | Vektor di-upsert sebelum metadata index siap | Upsert ulang, tunggu ±1 menit |
| Jawaban memakai isi dokumen lama | Chunk yatim dari versi sebelumnya | Ingest ulang; rekonsiliasi menghapusnya |
| `/ingest` mengembalikan 404 | Key tidak ada di R2 | Periksa `wrangler r2 object list` |
| `curl` ke `/chat` tidak mengalir | `curl` tanpa `-N` | Tambahkan `-N` |
| `wrangler r2` gagal `code: 10042` | R2 belum diaktifkan di dashboard | Aktifkan R2, atau tetap pakai mode lokal |
| `npm install` gagal `ENOSPC` | Disk penuh | Kosongkan ruang; kode ini juga jalan dengan Wrangler dari cache |
| Jawaban mengarang | Chunk benar tidak terambil | Periksa `/search` dulu, baru prompt |

## Keamanan dan batasan

Ini demo lokal, bukan layanan produksi.

- **Tanpa autentikasi dan rate limit.** Jangan diekspos ke internet tanpa Cloudflare Access dan pembatas request.
- **Chunk diperlakukan sebagai data tak tepercaya.** Prompt melarang mengikuti instruksi di dalam dokumen, tetapi pertahanan sebenarnya adalah tidak memberi model akses ke aksi berisiko.
- **Tidak ada logging isi dokumen.** Jangan menambahkannya tanpa alasan; itu data pribadi.
- **Belum ada evaluasi otomatis.** Perubahan chunking/prompt/model harus diukur dengan set pertanyaan tetap (lihat sesi 6).
- **Belum ada penghapusan dokumen.** Menghapus satu sumber berarti membersihkan R2, D1, dan Vectorize sekaligus.

## Biaya

Embedding seluruh korpus 1 juta token ≈ $0,012. Satu pertanyaan dengan 6 chunk konteks dan output 300 token ≈ $0,00024 dengan `qwen3-30b-a3b-fp8`. Batas gratis Workers AI adalah 10.000 neuron/hari.

## Referensi

- [Kursus lengkap](../index.html) — sesi 1–7
- [Cheat sheet](../reference/rag-pipeline-map.html) · [Cookbook](../reference/code-cookbook.html)
- [Cloudflare — Build a RAG AI](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai/)
- [Vectorize API](https://developers.cloudflare.com/vectorize/reference/client-api/) · [Limits](https://developers.cloudflare.com/vectorize/platform/limits/)
