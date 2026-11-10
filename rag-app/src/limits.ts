// Batas input. Angka ini melindungi biaya dan memori Worker, bukan selera.

export const MAX_QUESTION_CHARS = 2000;
export const MAX_QUERY_CHARS = 500;
export const MAX_KEY_CHARS = 200;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [".md", ".markdown", ".txt", ".pdf", ".html", ".docx"];
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function keyError(key: string): string | null {
	if (!key || key.length > MAX_KEY_CHARS) return "key tidak valid";
	if (key.includes("..") || key.includes("\\") || key.startsWith("/")) return "key tidak valid";
	if (!SAFE_KEY.test(key)) return "key tidak valid";

	const dot = key.lastIndexOf(".");
	if (dot < 0) return "ekstensi tidak didukung";

	const ext = key.slice(dot).toLowerCase();
	if (!ALLOWED_EXTENSIONS.includes(ext)) return "ekstensi tidak didukung";

	return null;
}
