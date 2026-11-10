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
- Bahasa: TypeScript — alasan lengkap dan nuansanya ada di bagian *Kenapa TypeScript, bukan Python*.

## Kenapa TypeScript, bukan Python

Python Workers **didukung penuh** (first-class): berjalan lewat Pyodide (CPython → WebAssembly) di dalam isolate V8, bisa akses semua binding, ada FastAPI/LangChain/Pydantic, dan CLI `pywrangler`. Jadi ini pilihan, bukan keterbatasan.

Lima alasan, beserta kekuatannya:

| Alasan | Bukti | Kekuatan |
|---|---|---|
| Dokumentasi JS-first | API Vectorize adalah API JS (`.query()`, `.upsert()`); tutorial RAG resmi JS; Python mengaksesnya lewat FFI | Tinggi untuk belajar (setiap contoh harus diterjemahkan = sumber bug) |
| Tipe dari binding | `wrangler types` menghasilkan tipe `Env`; salah nama binding/shape gagal saat build, bukan saat runtime | Sedang |
| Streaming & interop | TS meneruskan `ReadableStream` langsung; Python pakai `Response.new(...)` dan `to_js()` untuk dict → objek JS | Kecil–menengah |
| Runtime & paket | Pyodide; hanya pure-Python / wheel PyEmscripten / paket Pyodide; toolchain `uv` + Node + `pywrangler` | Nyata hanya untuk ingestion berat, hampir nol untuk memanggil Workers AI + Vectorize |
| Latar belakang user | Sudah lancar TS; Python menambah beban kognitif yang tidak terkait RAG | Tinggi untuk kecepatan belajar (personal, bukan superioritas bahasa) |

**Koreksi klaim:** jangan bilang "cold start Python lebih berat" tanpa nuansa. Cloudflare melakukan snapshot memori saat deploy, jadi inisialisasi mahal dikerjakan di deploy-time. Batasan yang benar-benar tersisa adalah ketersediaan paket dan toolchain, bukan startup.

**Kapan Python lebih tepat:** ingestion offline (`pypdf`, `unstructured`, analisis layout), evaluasi/analisis (`pandas`, `ragas`), atau tim yang memang Python. Pola sehat: batch Python di luar Workers → kirim ke Vectorize lewat REST API; serving tetap di Workers.

**Yang perlu diingat saat mengajar:** RAG tidak bergantung bahasa. 90% pekerjaannya HTTP, SQL, dan keputusan chunking — sama di kedua bahasa.

## Model embedding: kenapa bge-m3, dan apakah itu keputusan yang benar

Keduanya 1024 dimensi dan $0,0118/juta token di Workers AI. Jadi harga dan bentuk indeks bukan pembeda.

| | `@cf/baai/bge-m3` | `@cf/qwen/qwen3-embedding-0.6b` |
|---|---|---|
| Dimensi | 1024 | 1024 (MRL 32–1024) |
| Konteks di Cloudflare | 60.000 token | 8.192 token |
| Input API | satu bentuk: `text` | `queries` (+ `instruction`), `documents`, atau `text` |
| Perlu instruksi query | Tidak | Ya — 1–5% lebih baik bila dipakai |
| Rilis | Feb 2024 | Jun 2025 |
| MTEB multilingual (mean / retrieval) | 59,56 / 54,60 | 64,33 / 64,64 |

Angka MTEB berasal dari tabel di model card Qwen (mengutip leaderboard Mei 2025) — **vendor-reported**, bukan uji independen, dan tidak spesifik Bahasa Indonesia.

Alasan memilih bge-m3 di kursus ini (jujur):
1. API-nya satu bentuk: tidak ada asimetri query vs document, jadi tidak ada cara salah yang diam-diam menurunkan kualitas.
2. Tanpa instruksi query — satu hal lebih sedikit untuk dijelaskan ke pemula.
3. Konteks 60k di Cloudflare, aman kalau suatu saat meng-embed dokumen utuh.
4. Konservatif: lebih tua, lebih banyak contoh komunitas, perilaku lebih terduga.

Kelemahan keputusan ini: pada benchmark retrieval multilingual, qwen3-embedding-0.6b tampak jauh lebih kuat (64,6 vs 54,6). Jadi bge-m3 adalah **baseline yang aman**, bukan pilihan terbaik.

Kapan sebaiknya pindah: setelah harness sesi 6 ada, A/B keduanya pada golden set. Karena dimensi & harga sama, biayanya hanya satu indeks kedua + re-index. Jangan mencampur dua model dalam satu indeks, walau dimensinya sama — ruang vektornya berbeda.

Catatan teknis qwen3-embedding: pakai jalur `queries` (dengan `instruction`) untuk pertanyaan dan `documents` untuk chunk; kalau keduanya di-embed lewat `text`, kamu kehilangan keunggulan instruksi dan perbandingannya jadi tidak adil.

## Temuan dari menjalankan kode (Nov 2026)
Semua jalur sesi 2–5 dijalankan end-to-end di `rag-app/`. Yang berbeda dari asumsi materi:
- Propagasi Vectorize ±40–60 detik, bukan "beberapa detik" seperti tertulis di dokumentasi. Jangan menyimpulkan upsert gagal terlalu cepat.
- Metadata filter: vektor yang di-upsert sebelum metadata index siap mengembalikan 0 hasil; setelah re-upsert dan propagasi ±1 menit, filter bekerja. Urutan dan kesabaran dua-duanya wajib.
- Reranker mengembalikan `{ id, score }` dengan `id` = indeks `contexts` — sudah dikonfirmasi, bukan lagi caveat.
- R2 tidak bisa dipakai remote sebelum diaktifkan di dashboard; binding lokal tetap jalan.

## Sinkronisasi materi dengan rag-app (Nov 2026)
Materi dan cookbook disamakan dengan implementasi yang lulus test:
- `extract` membaca `.md`/`.txt` langsung, memakai `ObjectNotFoundError` (dipetakan ke 404).
- Sesi 3 menambah bagian rekonsiliasi chunk yatim, plus pertanyaan kuis dan langkah latihan.
- Harness sesi 6 memakai field `hits` (bukan `results`) sesuai respons API.
- Rerank di sesi 4 dan cookbook memakai pemetaan aman `{ id, score }` + fallback.
- Sesi 2 mencatat keterbatasan tipe hasil `wrangler types` dan pola wrapper `src/ai.ts`.
- Cookbook menambah wrapper AI, `ingestDoc` lengkap, dan contoh test API.

## Sesi 7 diperluas dengan guardrail (Nov 2026)
Bagian baru "Guardrail di kode" mengajarkan implementasi yang lulus 22 test: auth fail-closed dengan token→pengguna, urutan auth → rate limit → route, isolasi namespace + owner, batas input sebelum embedding, dan penegakan sitasi (422, bukan telepon). Termasuk jebakan penanda konteks `[1]` dan dua jebakan test (`every()` pada array kosong, jawaban model non-deterministik).

## Konvensi materi
- Setiap blok kode **wajib** punya label nama file lewat `<pre data-file="...">`, ditampilkan oleh CSS `pre[data-file]::before`.
- Blok yang bukan file diberi label jujur: `terminal` (perintah shell), `respons` (contoh keluaran), `rumus` (notasi).
- Struktur project yang dirujuk label: `src/index.ts`, `src/ingest.ts`, `src/search.ts`, `src/chat.ts`, `src/prompt.ts`, `scripts/eval.mjs`, `schema.sql`, `wrangler.jsonc`.
- Tanpa label, pembaca harus menebak lokasi kode — ini kesalahan materi yang sudah dikoreksi.

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
