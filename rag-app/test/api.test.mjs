import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WRANGLER = join(ROOT, "node_modules", ".bin", "wrangler");
const BASE = process.env.BASE_URL ?? "http://localhost:8787";

const SHRINK_KEY = "catatan/__test_shrink__.md";
const IDEM_KEY = "catatan/__test_idem__.md";

const LONG_DOC = `# Dokumen uji

Paragraf pertama menjelaskan bahwa dokumen ini dipakai untuk menguji penghapusan chunk yatim ketika isi dokumen berubah menjadi lebih pendek. Kalimat ini sengaja panjang supaya total teks melewati batas satu chunk dan menghasilkan lebih dari satu potongan. Di dalam paragraf ini juga dijelaskan bahwa setiap chunk harus dapat dipahami tanpa membaca bagian lain, sehingga pemotongan dilakukan pada batas paragraf, bukan di tengah kalimat. Overlap antar chunk menjaga kalimat yang terpotong tetap utuh di salah satu sisi, dan biaya embedding yang bertambah karena pengulangan teks masih jauh lebih murah daripada kehilangan konteks. Semua penjelasan ini hanya pelengkap agar panjang paragraf mendekati batas chunk pertama, bukan informasi yang diuji.

Paragraf kedua memuat frasa penanda yang unik: kucing oranye membaca koran. Frasa ini hanya ada di bagian akhir dokumen dan akan dipakai untuk memastikan chunk lama benar-benar hilang setelah dokumen dipersingkat. Supaya paragraf ini cukup panjang, ditambahkan penjelasan bahwa pengujian dilakukan dengan mengubah isi objek di R2, memanggil endpoint ingest, lalu memeriksa jumlah chunk di D1 dan hasil pencarian di Vectorize. Pemeriksaan di D1 bersifat langsung, sedangkan pemeriksaan di Vectorize memerlukan waktu karena mutasi diproses secara asinkron. Karena itu pengujian menunggu hingga batas waktu tertentu sebelum menyimpulkan bahwa chunk lama benar-benar sudah tidak dapat ditemukan.

Paragraf ketiga menambahkan konteks tambahan agar jumlah chunk stabil di dua buah selama pengujian berlangsung, tanpa bergantung pada paragraf lain di korpus. Paragraf ini juga memastikan bahwa dokumen uji tidak terlalu pendek sehingga jumlah chunk tidak berubah-ubah setiap kali ukuran chunk disesuaikan. Dengan tiga paragraf sepanjang ini, dokumen diharapkan menghasilkan dua chunk: satu berisi paragraf pertama, dan satu berisi sisa paragraf kedua dan ketiga. Harapan itu yang kemudian diperiksa oleh test sebelum dan sesudah dokumen dipersingkat.`;

const SHORT_DOC = `# Dokumen uji

Dokumen ini sudah dipersingkat menjadi satu paragraf saja.`;

function putDoc(key, text) {
	const path = join(tmpdir(), `rag-test-${Date.now()}-${Math.random()}.md`);
	writeFileSync(path, text);
	try {
		execFileSync(
			WRANGLER,
			["r2", "object", "put", `rag-docs/${key}`, "--file", path, "--local"],
			{ cwd: ROOT, stdio: "pipe" },
		);
	} finally {
		unlinkSync(path);
	}
}

async function ingest(key) {
	const res = await fetch(`${BASE}/ingest`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ key }),
	});
	return { status: res.status, body: await res.json() };
}

async function health() {
	const res = await fetch(`${BASE}/health`);
	return res.json();
}

async function countFor(source) {
	const h = await health();
	return h.bySource.find((r) => r.source === source)?.n ?? 0;
}

async function search(q, source) {
	const url = new URL(`${BASE}/search`);
	url.searchParams.set("q", q);
	if (source) url.searchParams.set("source", source);
	const res = await fetch(url);
	return res.json();
}

async function waitFor(predicate, { attempts = 45, delayMs = 4000 } = {}) {
	for (let i = 0; i < attempts; i++) {
		if (await predicate()) return true;
		await new Promise((r) => setTimeout(r, delayMs));
	}
	return false;
}

after(async () => {
	// Kembalikan keadaan: kosongkan dokumen uji supaya chunk-nya dibersihkan.
	try {
		putDoc(SHRINK_KEY, "");
		putDoc(IDEM_KEY, "");
		await ingest(SHRINK_KEY);
		await ingest(IDEM_KEY);
	} catch {
		// best effort
	}
});

test("ingest is idempotent: running twice does not add chunks", async () => {
	putDoc(IDEM_KEY, LONG_DOC);

	const first = await ingest(IDEM_KEY);
	assert.equal(first.status, 200);
	assert.ok(first.body.chunks > 0, "dokumen harus menghasilkan chunk");

	const before = await countFor(IDEM_KEY);
	assert.equal(before, first.body.chunks);

	const second = await ingest(IDEM_KEY);
	assert.equal(second.status, 200);
	assert.equal(second.body.embedded, 0, "run kedua tidak boleh meng-embed ulang");

	const afterCount = await countFor(IDEM_KEY);
	assert.equal(afterCount, before, "jumlah chunk tidak boleh berubah");
});

test("shrinking a document removes its orphan chunks", async () => {
	putDoc(SHRINK_KEY, LONG_DOC);
	const first = await ingest(SHRINK_KEY);
	assert.equal(first.status, 200);

	const firstCount = await countFor(SHRINK_KEY);
	assert.ok(firstCount >= 2, `dokumen panjang harus jadi >1 chunk (dapat ${firstCount})`);

	putDoc(SHRINK_KEY, SHORT_DOC);
	const second = await ingest(SHRINK_KEY);
	assert.equal(second.status, 200);
	assert.equal(second.body.chunks, 1);

	assert.equal(
		await countFor(SHRINK_KEY),
		1,
		"chunk yatim harus dihapus dari D1 setelah dokumen menyusut",
	);

	const gone = await waitFor(async () => {
		const result = await search("kucing oranye membaca koran", SHRINK_KEY);
		// Hasil kosong saat propagasi bukan bukti chunk yatim hilang.
		return result.hits.length > 0 && result.hits.every((h) => h.chunk_index === 0);
	});

	assert.ok(gone, "chunk yatim harus hilang dari Vectorize");
});

test("ingesting a missing object returns 404", async () => {
	const res = await ingest("catatan/tidak-ada.md");
	assert.equal(res.status, 404, "objek yang tidak ada bukan kesalahan server");
});

test("source filter only returns chunks from that source", async () => {
	putDoc(SHRINK_KEY, SHORT_DOC);
	await ingest(SHRINK_KEY);

	let result = { hits: [] };
	const appeared = await waitFor(async () => {
		result = await search("dokumen uji", SHRINK_KEY);
		return result.hits.length > 0;
	});

	assert.ok(appeared, "hasil harus muncul setelah propagasi");
	for (const hit of result.hits) {
		assert.equal(hit.source, SHRINK_KEY);
	}
});
