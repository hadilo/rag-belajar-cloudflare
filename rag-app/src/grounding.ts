// Kebijakan grounding: jawaban hanya dianggap bersumber jika semua sitasinya
// menunjuk file yang benar-benar dikirim sebagai konteks. Tautan markdown
// [teks](url) bukan sitasi dan tidak boleh dihitung.

export type Assessment = {
	cited: string[];
	invalid: string[];
	hasCitation: boolean;
	refused: boolean;
	grounded: boolean;
};

const REFUSAL = /tidak ada di dokumen/i;

export function parseCitations(answer: string): string[] {
	const found: string[] = [];
	const pattern = /\[([^\]]+)\](?!\()/g;

	let match: RegExpExecArray | null;
	while ((match = pattern.exec(answer)) !== null) {
		for (const part of match[1].split(/[,;]/)) {
			const name = part.trim();
			// Angka dalam kurung adalah penanda konteks, bukan nama file.
			if (name && !/^\d+$/.test(name)) found.push(name);
		}
	}

	return [...new Set(found)];
}

export function assessAnswer(answer: string, sources: string[]): Assessment {
	const allowed = new Set(sources);
	const cited = parseCitations(answer);
	const invalid = cited.filter((name) => !allowed.has(name));
	const refused = REFUSAL.test(answer);

	return {
		cited,
		invalid,
		hasCitation: cited.length > 0,
		refused,
		grounded: invalid.length === 0 && (refused || cited.length > 0),
	};
}
