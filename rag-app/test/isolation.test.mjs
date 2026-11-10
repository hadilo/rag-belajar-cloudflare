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

const USERS = {
	dev: { token: process.env.API_TOKEN ?? "dev-token", ip: "203.0.113.201" },
	bob: { token: process.env.TOKEN_B ?? "token-b", ip: "203.0.113.202" },
};

const A_KEY = "catatan/__iso_a__.md";
const B_KEY = "catatan/__iso_b__.md";
const SHARED_KEY = "catatan/__iso_sama__.md";

function putDoc(user, key, text) {
	const path = join(tmpdir(), `rag-iso-${Date.now()}-${Math.random()}.md`);
	writeFileSync(path, text);
	try {
		execFileSync(
			WRANGLER,
			["r2", "object", "put", `rag-docs/users/${user}/${key}`, "--file", path, "--local"],
			{ cwd: ROOT, stdio: "pipe" },
		);
	} finally {
		unlinkSync(path);
	}
}

function api(user, path, init = {}) {
	return fetch(`${BASE}${path}`, {
		...init,
		headers: {
			authorization: `Bearer ${USERS[user].token}`,
			"cf-connecting-ip": USERS[user].ip,
			...(init.headers ?? {}),
		},
	});
}

async function ingest(user, key) {
	const res = await api(user, "/ingest", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ key }),
	});
	return { status: res.status, body: await res.json() };
}

async function search(user, q, source) {
	const url = new URL(`${BASE}/search`);
	url.searchParams.set("q", q);
	if (source) url.searchParams.set("source", source);
	const res = await api(user, url.pathname + url.search);
	return res.json();
}

async function health(user) {
	const res = await api(user, "/health");
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
	for (const user of Object.keys(USERS)) {
		for (const key of [A_KEY, B_KEY, SHARED_KEY]) {
			try {
				putDoc(user, key, "");
				await ingest(user, key);
			} catch {
				// best effort
			}
		}
	}
});

test("one user cannot retrieve another user's chunks", async () => {
	putDoc("dev", A_KEY, "# Alpha\n\nFrasa alpha unik milik pengguna dev.");
	putDoc("bob", B_KEY, "# Beta\n\nFrasa beta unik milik pengguna bob.");

	assert.equal((await ingest("dev", A_KEY)).status, 200);
	assert.equal((await ingest("bob", B_KEY)).status, 200);

	const devHits = await search("dev", "frasa beta unik milik bob");
	assert.ok(
		devHits.hits.every((h) => h.source !== B_KEY),
		"dev tidak boleh melihat dokumen bob",
	);

	const bobHits = await search("bob", "frasa alpha unik milik dev");
	assert.ok(
		bobHits.hits.every((h) => h.source !== A_KEY),
		"bob tidak boleh melihat dokumen dev",
	);
});

test("health counts only the caller's chunks", async () => {
	const dev = await health("dev");
	assert.ok(
		dev.bySource.every((r) => r.source !== B_KEY),
		"health dev tidak boleh memuat sumber milik bob",
	);

	const bob = await health("bob");
	assert.ok(
		bob.bySource.every((r) => r.source !== A_KEY),
		"health bob tidak boleh memuat sumber milik dev",
	);
});

test("the same logical key is isolated per user", async () => {
	putDoc("dev", SHARED_KEY, "# Bersama\n\nIsi versi dev: gamma milik dev.");
	putDoc("bob", SHARED_KEY, "# Bersama\n\nIsi versi bob: delta milik bob.");

	await ingest("dev", SHARED_KEY);
	await ingest("bob", SHARED_KEY);

	let dev = { hits: [] };
	let bob = { hits: [] };

	const devReady = await waitFor(async () => {
		dev = await search("dev", "gamma milik dev", SHARED_KEY);
		return dev.hits.length > 0;
	});
	const bobReady = await waitFor(async () => {
		bob = await search("bob", "delta milik bob", SHARED_KEY);
		return bob.hits.length > 0;
	});

	assert.ok(devReady, "dev harus menemukan versinya");
	assert.ok(bobReady, "bob harus menemukan versinya");

	assert.ok(dev.hits.every((h) => h.preview.includes("gamma")), "dev tidak boleh melihat isi bob");
	assert.ok(bob.hits.every((h) => h.preview.includes("delta")), "bob tidak boleh melihat isi dev");
});
