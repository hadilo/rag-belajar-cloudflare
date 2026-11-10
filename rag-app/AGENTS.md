# AGENTS.md

Panduan untuk agen coding yang bekerja di `rag-app/`. Tujuannya: perubahan tetap konsisten dengan arsitektur RAG yang sudah diuji, tanpa merusak indeks atau membuat klaim yang tidak terverifikasi.

## Ringkasan project

Implementasi RAG yang bisa dijalankan dari materi kursus (sesi 2–5 di direktori induk). Worker menjawab pertanyaan berdasarkan dokumen di R2, dengan chunk di D1 dan vektor di Vectorize.

Alur: `R2 → chunk → embed (bge-m3) → Vectorize` (index-time), lalu `pertanyaan → embed → query → rerank → prompt → LLM → jawaban + sitasi` (query-time).

## Perintah

```bash
# development
npx wrangler dev --port 8787

# skema database lokal
npx wrangler d1 execute rag --local --file=schema.sql

# seed + indeks dokumen contoh
curl -X POST localhost:8787/seed
curl -X POST localhost:8787/ingest -H 'content-type: application/json' -d '{"all":true}'

# tanya
curl -X POST 'localhost:8787/chat?format=json' -H 'content-type: application/json' -d '{"question":"..."}'

# verifikasi
npm test            # butuh dev server berjalan
npm run typecheck
```

Catatan lingkungan: `npm install` bisa gagal karena disk hampir penuh. Wrangler tersedia lewat cache `npx`; jangan menambah dependency baru tanpa memastikan ruang disk cukup.

## Struktur

| File | Tanggung jawab |
|---|---|
| `src/index.ts` | Routing HTTP, seed dokumen, orkestrasi |
| `src/ingest.ts` | `extract`, `chunkText`, `sha256`, `ingestDoc` |
| `src/search.ts` | Embed query, query Vectorize, join D1, rerank, `rrf`, `lexicalRank` |
| `src/chat.ts` | Prompt, generation, verifikasi sitasi |
| `src/prompt.ts` | Konstanta `SYSTEM` |
| `schema.sql` | Skema D1 |

Jangan menaruh logika retrieval di `index.ts`; route hanya memanggil fungsi dari modul di atas.

## Aturan arsitektur (jangan dilanggar)

1. **Model embedding harus sama untuk indexing dan query.** Saat ini `@cf/baai/bge-m3`, 1024 dimensi, cosine. Ganti model = buat indeks baru + re-index seluruh korpus.
2. **Dimensi indeks tidak bisa diubah.** Jangan menambah parameter dimensi; indeks dikunci saat dibuat.
3. **Metadata index dibuat sebelum vektor di-upsert.** Vektor yang masuk lebih dulu tidak bisa difilter, dan perbaikannya hanya upsert ulang.
4. **ID vektor deterministik:** `${source}#${index}`. Jangan memakai UUID acak; itu merusak idempotensi dan membuat retry Workflow menggandakan data.
5. **Hash isi di D1 menentukan skip.** Chunk yang hash-nya sama tidak boleh di-embed ulang.
6. **Batch kecil.** Maksimum 20 chunk per panggilan embed di kode ini; batas platform 1.000 upsert per panggilan. Jangan mengirim seluruh korpus dalam satu request.
7. **Filter sebelum topK.** `topK` maksimum 50 bila metadata diminta; jangan menaikkannya tanpa mengubah `returnMetadata`.
8. **Rerank mempersempit, bukan memperluas.** Ambil 20 kandidat, kirim 6 chunk ke model.
9. **Sitasi diverifikasi di kode**, bukan dipercaya dari model. Setiap nama file yang dikutip harus ada di daftar `sources` hasil retrieval.
10. **Chunk adalah input tidak tepercaya.** Jangan memberi model kemampuan memicu aksi (fetch, tulis DB, kirim pesan) berdasarkan isi dokumen.
11. **Ingestion harus merekonsiliasi.** Setelah memproses chunk baru, hapus ID lama milik sumber yang sama dari D1 dan Vectorize. Tanpa ini, dokumen yang menyusut meninggalkan chunk yatim yang masih bisa muncul di jawaban.
12. **Panggilan AI lewat `src/ai.ts`.** Tipe hasil `wrangler types` tidak lengkap (input reranker kehilangan `query`, output embedding berupa union), jadi cast diisolasi di sana. Jangan memanggil `env.AI.run` langsung dari modul domain, dan jangan melepas `run` dari objeknya — `this` hilang dan gagal saat runtime.

## Konvensi kode

- TypeScript strict; hindari `any`. Tipe bentuk respons AI dideklarasikan di tempat pemakaian.
- Gaya file: tab, tanda kutip ganda, titik koma. Ikuti file yang sudah ada.
- Router memakai `URL` + `Response` biasa (tanpa framework) agar tetap jalan tanpa install dependency.
- Respons error selalu JSON `{ error: string }` dengan status yang sesuai; jangan melempar error mentah ke klien.
- `search()` mengembalikan `Hit[]` yang sudah diurutkan. Jangan mengandalkan urutan hasil SQL `IN (...)`.
- Jangan menambah logging isi dokumen atau pertanyaan pengguna; itu data pribadi dan memakan kuota log.

## Testing

Seam yang disepakati: **HTTP API** (`/ingest`, `/health`, `/search`), black-box, dijalankan terhadap `wrangler dev`. Test tidak boleh mengimpor modul internal atau memeriksa D1 secara langsung — semua lewat endpoint.

- Tulis test merah dulu, baru perbaiki kode.
- Jangan menguji jawaban LLM secara eksak; itu flaky. Uji perilaku yang deterministik (jumlah chunk, status code, filter, keberadaan ID).
- Propagasi Vectorize membuat beberapa assertion harus menunggu (`waitFor`), bukan `sleep` tetap. Hasil kosong saat menunggu bukan bukti: sertakan `hits.length > 0` di predicate, kalau tidak `every()` akan lolos secara vacuous.
- `npm test` membutuhkan dev server berjalan. Jika gagal karena koneksi, itu masalah setup, bukan kode.

## Alur verifikasi (wajib sebelum menyatakan selesai)

1. `GET /health` → jumlah chunk sesuai harapan.
2. `POST /ingest` dua kali → run kedua `embedded: 0`.
3. `GET /search?q=...` → file sumber yang benar muncul; periksa `score` dan `rerankScore`.
4. `POST /chat?format=json` → `invalid: []` dan sitasi menunjuk file yang benar.
5. Pertanyaan di luar korpus → jawaban menolak, bukan mengarang.
6. `POST /chat` tanpa `format=json` → keluar `text/event-stream`.

Jika mengubah chunking, prompt, atau model: jalankan ulang langkah 2–5 pada set pertanyaan yang sama dan catat perbedaannya. Jangan menyimpulkan "lebih baik" tanpa angka.

## Kendala platform yang sudah terbukti

- **Propagasi Vectorize 40–60 detik.** Upsert yang belum terlihat bukan berarti gagal; tunggu sebelum menyimpulkan.
- **Metadata filter butuh urutan dan waktu.** Re-upsert setelah metadata index siap, lalu tunggu sekitar satu menit.
- **R2 belum aktif di akun ini**, jadi `DOCS` berjalan lokal. `wrangler r2` remote akan gagal sampai R2 diaktifkan di dashboard.
- **Vectorize berjalan remote**, D1 dan R2 lokal. Jangan mengubah `remote` tanpa memahami konsekuensinya.
- Model AI berjalan remote; setiap uji memakai neuron. Hindari loop pengujian besar tanpa alasan.

## Jangan

- Commit `node_modules/`, `.wrangler/`, atau `.dev.vars`.
- Hardcode API key atau token; gunakan binding dan secret.
- Menghapus `AGENTS.md`, `README.md`, atau `schema.sql` sebagai "pembersihan".
- Mengubah materi kursus di direktori induk (`../lessons/`, `../reference/`) saat tugasnya hanya di `rag-app/`.
- Menjalankan `wrangler deploy` tanpa konfirmasi: itu mengubah resource akun dan bisa memicu biaya.
