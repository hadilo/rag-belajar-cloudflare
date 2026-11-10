# RAG Glossary

Kosakata kanonik untuk workspace ini. Entri dipromosikan ke sini setelah terbukti dipahami (dipakai benar di latihan/kuis), bukan sekadar dibaca.

## Inti

**RAG (Retrieval-Augmented Generation)**:
Pola di mana dokumen diambil dulu berdasarkan kemiripan makna dengan pertanyaan, lalu potongan yang terambil dimasukkan ke prompt sebagai konteks untuk model generasi.
_Avoid_: "AI yang baca dokumen", "fine-tuning ringan"

**Embedding**:
Vektor angka yang mewakili makna sebuah teks, dihasilkan model khusus, sehingga teks dengan makna mirip menghasilkan vektor yang berdekatan.
_Avoid_: "enkripsi teks", "hash"

**Chunk**:
Potongan teks berukuran terbatas yang di-embed dan disimpan sebagai satu unit retrieval.
_Avoid_: "paragraf", "potongan file"

**Retrieval**:
Proses mengambil K chunk paling relevan untuk sebuah pertanyaan dari indeks vektor.
_Avoid_: "pencarian Google", "query database"

**Index-time**:
Tahap yang berjalan saat dokumen masuk atau berubah; boleh lambat dan asinkron karena tidak menunggu pengguna.
_Avoid_: "backend", "ETL"

**Query-time**:
Tahap yang berjalan untuk setiap pertanyaan pengguna; dibatasi latency, jadi harus seringan mungkin.
_Avoid_: "runtime", "inference"

## Cloudflare

**Vectorize**:
Vector database Cloudflare; menyimpan vektor beserta metadata dan mencarinya berdasarkan jarak (cosine/euclidean/dot-product).
_Avoid_: "Vector DB", "database AI"

**Workers AI**:
Runtime inferensi Cloudflare dengan binding `env.AI`, dipakai untuk embedding maupun text generation, ditagih dalam neuron.
_Avoid_: "Cloudflare GPT", "AI API"

**Metadata filter**:
Penyaringan kandidat berdasarkan properti vektor (mis. `source`, `tanggal`) sebelum top-K dihitung; butuh metadata index yang dibuat lebih dulu.
_Avoid_: "where clause", "tag"

**top-K**:
Jumlah chunk teratas yang dikembalikan satu query; batasnya 50 bila metadata/values ikut diminta.
_Avoid_: "limit hasil", "page size"

## Retrieval lanjutan

**Reranker**:
Model cross-encoder yang membaca pertanyaan dan chunk bersamaan lalu memberi skor relevansi; akurat tapi mahal per pasangan, jadi dipakai setelah retrieval murah.
_Avoid_: "penyaring hasil", "scorer"

**Hybrid search**:
Penggabungan hasil pencarian vektor dengan pencarian leksikal (kata kunci) untuk menangkap kode, nama, dan angka yang tidak tertangkap makna.
_Avoid_: "dual search", "pencarian ganda"

**RRF (Reciprocal Rank Fusion)**:
Cara menggabungkan beberapa daftar peringkat memakai posisi, bukan skor mentah, sehingga skor dari sistem berbeda tidak perlu dinormalkan.
_Avoid_: "score averaging", "penggabungan skor"

**Namespace**:
Partisi di dalam satu indeks Vectorize yang menyaring kandidat paling awal; dipakai untuk isolasi per pengguna atau tenant.
_Avoid_: "folder", "collection"

**Chunk overlap**:
Bagian teks yang sengaja diulang di antara dua chunk berdekatan agar kalimat yang terpotong tetap utuh di salah satunya.
_Avoid_: "duplikasi", "padding"

## Operasional

**Idempotent**:
Sifat operasi yang menghasilkan keadaan akhir sama walau dijalankan berulang; pada ingestion dicapai lewat ID vektor yang stabil.
_Avoid_: "repeatable", "safe retry"

**Failed retrieval**:
Kasus ketika chunk yang memuat jawaban tidak masuk kandidat yang dikirim ke model — kegagalan di lapisan retrieval, bukan generation.
_Avoid_: "hallucination", "jawaban salah"
