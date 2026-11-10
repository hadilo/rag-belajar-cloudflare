interface Env {
	/** Secret JSON: {"token":"user"}. Bentuk utama konfigurasi identitas. */
	API_TOKENS?: string;
	/** Fallback pengembangan: satu token, dipetakan ke pengguna "default". */
	API_TOKEN?: string;
	/** "true" hanya di lingkungan pengembangan. Default mati. */
	ENABLE_DEBUG?: string;
	/** Batas request per menit per IP. Default 30. */
	RATE_LIMIT_PER_MINUTE?: string;
}
