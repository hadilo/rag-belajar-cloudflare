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
TOKEN=dev-token
curl -X POST localhost:8787/seed -H "authorization: Bearer $TOKEN"
curl -X POST localhost:8787/ingest -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"all":true}'

# tanya
curl -X POST 'localhost:8787/chat?format=json' -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"question":"..."}'

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
13. **Guardrail berurutan: auth → rate limit → route.** Jangan membaliknya; request tanpa token tidak boleh menghabiskan kuota, dan endpoint debug harus dicek setelah auth.
14. **Fail closed.** Tanpa `API_TOKENS` (atau `API_TOKEN`) yang valid, endpoint yang dilindungi menolak semua request. Jangan menambah fallback "kalau kosong berarti terbuka".
15. **Token tidak pernah dicetak atau dilog.** Nilai token hanya dari secret/`.dev.vars`; `.dev.vars` tidak boleh di-commit.
16. **Isolasi selalu dua lapis: namespace Vectorize + kolom `owner` di D1.** Setiap upsert/query memakai `namespace: user`; setiap SELECT/DELETE menyertakan `owner = ?`. Jangan menambah query chunk tanpa filter owner.
17. **Batas input ada di `src/limits.ts`.** Jangan menaikkan angka atau melewati `keyError` tanpa alasan; batas ini melindungi biaya dan memori Worker.
18. **Penegakan sitasi bersifat menolak.** Sitasi yang tidak ada di `sources` → 422 `unsupported_citation`, bukan sekadar flag. Label konteks memakai `Konteks n (sumber)`, bukan `[n]`, agar tidak tertukar dengan sitasi.

## Konvensi kode

- TypeScript strict; hindari `any`. Tipe bentuk respons AI dideklarasikan di tempat pemakaian.
- Gaya file: tab, tanda kutip ganda, titik koma. Ikuti file yang sudah ada.
- Router memakai `URL` + `Response` biasa (tanpa framework) agar tetap jalan tanpa install dependency.
- Respons error selalu JSON `{ error: string }` dengan status yang sesuai; jangan melempar error mentah ke klien.
- `search()` mengembalikan `Hit[]` yang sudah diurutkan. Jangan mengandalkan urutan hasil SQL `IN (...)`.
- Jangan menambah logging isi dokumen atau pertanyaan pengguna; itu data pribadi dan memakan kuota log.

## Testing

Seam yang disepakati: **HTTP API** (`/ingest`, `/health`, `/search`, `/chat`, `/verify`), black-box, dijalankan terhadap `wrangler dev`. Test tidak boleh mengimpor modul internal atau memeriksa D1 secara langsung — semua lewat endpoint.

- Tulis test merah dulu, baru perbaiki kode.
- Jangan menguji jawaban LLM secara eksak; itu flaky. Uji perilaku yang deterministik (jumlah chunk, status code, filter, keberadaan ID). Untuk `/chat`, uji kontraknya: 200 harus punya `grounded`, 422 harus `unsupported_citation`.
- Propagasi Vectorize membuat beberapa assertion harus menunggu (`waitFor`), bukan `sleep` tetap. Hasil kosong saat menunggu bukan bukti: sertakan `hits.length > 0` di predicate, kalau tidak `every()` akan lolos secara vacuous.
- File test dijalankan berurutan (`--test-concurrency=1`) karena semuanya memakai satu dev server dan korpus yang sama. Jangan menghapus flag itu tanpa mengganti state per test.
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
- **Test menolak berjalan di luar localhost.** `test/guard.mjs` memeriksa `BASE_URL`; jangan melewatinya. Test ini menulis dan menghapus data, jadi menjalankannya ke produksi akan merusak korpus.
- **Repo ini publik.** Jangan pernah menambahkan secret, ID akun, hasil `wrangler d1 export`, atau dokumen pribadi ke dalam tree. Token `dev-token` sengaja ada di dokumentasi untuk lokal, bukan untuk deployment.
- **Vectorize berjalan remote**, D1 dan R2 lokal. Jangan mengubah `remote` tanpa memahami konsekuensinya.
- Model AI berjalan remote; setiap uji memakai neuron. Hindari loop pengujian besar tanpa alasan.

## Jangan

- Commit `node_modules/`, `.wrangler/`, atau `.dev.vars`.
- Hardcode API key atau token; gunakan binding dan secret.
- Menghapus `AGENTS.md`, `README.md`, atau `schema.sql` sebagai "pembersihan".
- Mengubah materi kursus di direktori induk (`../lessons/`, `../reference/`) saat tugasnya hanya di `rag-app/`.
- Menjalankan `wrangler deploy` tanpa konfirmasi: itu mengubah resource akun dan bisa memicu biaya.
