import { test } from "node:test";
import { baseUrl } from "./guard.mjs";
import assert from "node:assert/strict";

const BASE = baseUrl();
const TOKEN = process.env.API_TOKEN ?? "dev-token";

function post(path, body) {
	return fetch(`${BASE}${path}`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${TOKEN}`,
			"cf-connecting-ip": `192.0.2.${Math.floor(Math.random() * 200) + 1}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
}

test("verify accepts a citation that exists in sources", async () => {
	const res = await post("/verify", {
		answer: "Overlap disarankan 10 persen [catatan/rag.md].",
		sources: ["catatan/rag.md", "catatan/cloudflare.md"],
	});

	assert.equal(res.status, 200);
	const body = await res.json();
	assert.equal(body.grounded, true);
	assert.deepEqual(body.invalid, []);
});

test("verify rejects a citation that does not exist in sources", async () => {
	const res = await post("/verify", {
		answer: "Overlap disarankan 10 persen [catatan/palsu.md].",
		sources: ["catatan/rag.md"],
	});

	assert.equal(res.status, 200);
	const body = await res.json();
	assert.equal(body.grounded, false);
	assert.deepEqual(body.invalid, ["catatan/palsu.md"]);
});

test("verify ignores markdown links and splits grouped citations", async () => {
	const res = await post("/verify", {
		answer: "Lihat [dokumen](https://example.com) dan [catatan/rag.md, catatan/cloudflare.md].",
		sources: ["catatan/rag.md", "catatan/cloudflare.md"],
	});

	assert.equal(res.status, 200);
	const body = await res.json();
	assert.deepEqual(body.invalid, []);
	assert.deepEqual(body.cited.sort(), ["catatan/cloudflare.md", "catatan/rag.md"]);
});

test("verify treats a refusal without citations as grounded", async () => {
	const res = await post("/verify", {
		answer: "Tidak ada di dokumen saya.",
		sources: ["catatan/rag.md"],
	});

	assert.equal(res.status, 200);
	const body = await res.json();
	assert.equal(body.grounded, true);
});

test("chat reports grounding in its JSON response", async () => {
	const res = await post("/chat?format=json", {
		question: "Berapa dimensi bge-m3?",
	});

	// Jawaban model tidak deterministik: boleh grounded, boleh ditolak karena
	// sitasi tidak cocok. Yang diuji adalah kontrak kedua jalur itu.
	assert.ok(
		res.status === 200 || res.status === 422,
		`status tak terduga: ${res.status}`,
	);

	const body = await res.json();
	assert.ok(Array.isArray(body.invalid), "invalid harus array");

	if (res.status === 200) {
		assert.equal(typeof body.grounded, "boolean");
	} else {
		assert.equal(body.error, "unsupported_citation");
	}
});
