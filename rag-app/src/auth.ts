// Identitas + guardrail autentikasi.
//
// Satu token = satu pengguna. Token disimpan sebagai JSON di API_TOKENS,
// misalnya {"tok-a":"alice","tok-b":"bob"}. API_TOKEN tunggal masih didukung
// untuk pengembangan dan dipetakan ke pengguna "default".
//
// Fail closed: tanpa konfigurasi token yang valid, semua endpoint yang
// dilindungi menolak request.

export type Identity = { user: string };

const USER_ID = /^[a-z0-9_-]{1,32}$/;

function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

function deny(status: number, body: Record<string, string>, extra: Record<string, string> = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json; charset=utf-8", ...extra },
	});
}

function tokenMap(env: Env): Record<string, string> | null {
	if (env.API_TOKENS) {
		try {
			const parsed: unknown = JSON.parse(env.API_TOKENS);
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

			const map: Record<string, string> = {};
			for (const [token, user] of Object.entries(parsed as Record<string, unknown>)) {
				if (typeof user === "string" && USER_ID.test(user)) map[token] = user;
			}
			return Object.keys(map).length > 0 ? map : null;
		} catch {
			return null;
		}
	}

	if (env.API_TOKEN) return { [env.API_TOKEN]: "default" };
	return null;
}

export function authenticate(request: Request, env: Env): Identity | Response {
	const map = tokenMap(env);
	if (!map) {
		return deny(500, { error: "server belum dikonfigurasi: API_TOKENS" });
	}

	const header = request.headers.get("authorization") ?? "";
	const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

	for (const [token, user] of Object.entries(map)) {
		if (safeEqual(token, presented)) return { user };
	}

	return deny(401, { error: "unauthorized" }, { "www-authenticate": "Bearer" });
}
