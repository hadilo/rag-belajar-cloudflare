import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:8787";
const TOKEN = process.env.API_TOKEN ?? "dev-token";
const IP = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;

function request(path, init = {}) {
	return fetch(`${BASE}${path}`, {
		...init,
		headers: {
			authorization: `Bearer ${TOKEN}`,
			"cf-connecting-ip": IP,
			...(init.headers ?? {}),
		},
	});
}

test("root stays public for uptime checks", async () => {
	const res = await fetch(`${BASE}/`);
	assert.equal(res.status, 200);
});

test("rejects a request without a token", async () => {
	const res = await fetch(`${BASE}/health`, {
		headers: { "cf-connecting-ip": IP },
	});
	assert.equal(res.status, 401);
});

test("rejects a request with the wrong token", async () => {
	const res = await fetch(`${BASE}/health`, {
		headers: {
			authorization: "Bearer token-palsu",
			"cf-connecting-ip": IP,
		},
	});
	assert.equal(res.status, 401);
});

test("accepts a request with the configured token", async () => {
	const res = await request("/health");
	assert.equal(res.status, 200);
});

test("debug endpoints are disabled by default", async () => {
	const res = await request("/debug/rrf?q=uji");
	assert.equal(res.status, 404);
});

test("rate limits repeated requests from one client", async () => {
	const seen = [];

	for (let i = 0; i < 40; i++) {
		const res = await request("/health");
		seen.push(res.status);

		if (res.status === 429) {
			const retryAfter = res.headers.get("retry-after");
			assert.ok(retryAfter, "429 harus menyertakan retry-after");
			assert.ok(Number(retryAfter) > 0, "retry-after harus angka positif");
			return;
		}
	}

	assert.fail(`tidak pernah kena 429; status: ${seen.join(",")}`);
});
