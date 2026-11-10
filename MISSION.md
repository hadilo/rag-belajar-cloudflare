# Mission: RAG Chat di Cloudflare

## Why
Saya ingin bisa membangun sendiri chatbot yang menjawab pertanyaan dari dokumen pribadi saya (catatan, PDF, markdown) dan menjalankannya di Cloudflare — bukan sekadar menyalin tutorial, tapi paham setiap komponen sehingga bisa mendiagnosis kenapa jawabannya salah dan memperbaikinya.

## Success looks like
- Saya bisa menggambar pipeline RAG dari memori dan menjelaskan peran tiap komponen Cloudflare.
- Saya punya Worker yang ter-deploy, bisa menerima pertanyaan dan menjawab dengan sitasi ke file sumber.
- Saya bisa mengukur kualitas: punya set pertanyaan uji sendiri, tahu cara menaikkan recall tanpa menebak-nebak.
- Saya bisa memperkirakan biaya bulanan dan menjelaskan trade-off chunk size, topK, reranker, dan model.
- Saya tahu kapan sebaiknya berhenti membangun sendiri dan pakai layanan managed (AI Search).

## Constraints
- Bahasa materi: Indonesia, istilah teknis tetap Inggris.
- Sudah lancar TypeScript/JavaScript — tidak perlu dasar bahasa atau dasar web.
- Sesi pendek: satu konsep per sesi, ada latihan kecil yang konkret.
- Jalur belajar: bangun manual (Workers + Vectorize + Workers AI), bukan managed service.
- Tidak ada deadline; prioritas retensi jangka panjang, bukan kecepatan menyelesaikan kurikulum.

## Out of scope
- Fine-tuning model dan training dari nol.
- Multi-tenant SaaS (billing, organisasi, kontrol akses kompleks).
- Frontend framework berat (React/Next) — cukup HTML/TS sampai UI perlu.
- Vector database lain (pgvector, Pinecone, Qdrant) kecuali sebagai pembanding konsep.
