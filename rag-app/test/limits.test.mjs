import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WRANGLER = join(ROOT, "node_modules", ".bin", "wrangler");
const BASE = process.env.BASE_URL ?? "http://localhost:8787";
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

function get(path) {
	return fetch(`${BASE}${path}`, {
		headers: {
			authorization: `Bearer ${TOKEN}`,
			"cf-connecting-ip": `192.0.2.${Math.floor(Math.random() * 200) + 1}`,
		},
	});
}

test("chat rejects a question above the character limit", async () => {
	const res = await post("/chat?format=json", { question: "x".repeat(2001) });
	assert.equal(res.status, 413);
	const body = await res.json();
	assert.equal(body.error, "question_too_long");
});

test("search rejects a query above the character limit", async () => {
	const res = await get(`/search?q=${encodeURIComponent("x".repeat(501))}`);
	assert.equal(res.status, 413);
});

test("ingest rejects path traversal and unsupported extensions", async () => {
	const traversal = await post("/ingest", { key: "../rahasia.md" });
	assert.equal(traversal.status, 400);

	const unsupported = await post("/ingest", { key: "catatan/berkas.exe" });
	assert.equal(unsupported.status, 400);
});

test("ingest rejects a file above the size limit", async () => {
	const key = "catatan/__test_besar__.md";
	const path = join(tmpdir(), `rag-big-${Date.now()}.md`);
	writeFileSync(path, "x".repeat(5 * 1024 * 1024 + 1));

	try {
		execFileSync(
			WRANGLER,
			["r2", "object", "put", `rag-docs/users/dev/${key}`, "--file", path, "--local"],
			{ cwd: ROOT, stdio: "pipe" },
		);
		const res = await post("/ingest", { key });
		assert.equal(res.status, 413);
	} finally {
		unlinkSync(path);
	}
});
