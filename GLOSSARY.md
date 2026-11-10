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
