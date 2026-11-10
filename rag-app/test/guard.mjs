// Guard untuk semua test: jangan pernah biarkan `BASE_URL` menunjuk ke server
// sungguhan. Test ini menulis dokumen uji dan menghapus chunk, jadi menjalankannya
// terhadap produksi akan merusak data.

export function baseUrl() {
	const raw = process.env.BASE_URL ?? "http://localhost:8787";

	let url;
	try {
		url = new URL(raw);
	} catch {
		throw new Error(`BASE_URL tidak valid: ${raw}`);
	}

	const local = ["localhost", "127.0.0.1", "::1", "[::1]"];
	if (!local.includes(url.hostname)) {
		throw new Error(
			`Test menolak berjalan terhadap ${url.hostname}. ` +
				"Test ini menulis dan menghapus data; gunakan hanya server lokal.",
		);
	}

	return raw.replace(/\/$/, "");
}
