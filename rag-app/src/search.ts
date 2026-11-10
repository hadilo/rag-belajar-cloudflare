import { embed, rerank } from "./ai";

export type Hit = {
	id: string;
	source: string;
	chunk_index: number;
	text: string;
	score: number;
	rerankScore?: number;
};

export type SearchResult = {
	hits: Hit[];
	matches: number;
	candidates: number;
	reranker: string;
	rerankerSample?: unknown;
};

export function rrf(lists: string[][], k = 60): [string, number][] {
	const scores = new Map<string, number>();
	for (const list of lists) {
		list.forEach((id, i) => {
			scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1));
		});
	}
	return [...scores.entries()].sort((a, b) => b[1] - a[1]);
}

export function lexicalRank(question: string, candidates: Hit[]): string[] {
	const terms = question
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((t) => t.length > 2);

	return [...candidates]
		.map((c) => ({
			id: c.id,
			score: terms.reduce(
				(n, t) => n + (c.text.toLowerCase().includes(t) ? 1 : 0),
				0,
			),
		}))
		.sort((a, b) => b.score - a.score)
		.map((x) => x.id);
}

export async function search(
	env: Env,
	question: string,
	topK = 20,
	finalK = 6,
	opts: { source?: string } = {},
): Promise<SearchResult> {
	const vectors = await embed(env, [question]);
	const queryVector = vectors[0];
	if (!queryVector) {
		return { hits: [], matches: 0, candidates: 0, reranker: "no-embedding" };
	}

	const queryOptions: VectorizeQueryOptions = {
		topK,
		returnMetadata: "all",
	};
	if (opts.source) queryOptions.filter = { source: opts.source };

	const { matches } = await env.INDEX.query(queryVector, queryOptions);

	if (!matches.length) {
		return { hits: [], matches: 0, candidates: 0, reranker: "no-matches" };
	}

	const ids = matches.map((m) => m.id);
	const placeholders = ids.map(() => "?").join(",");

	const { results } = await env.DB.prepare(
		`SELECT id, source, chunk_index, text
		 FROM chunks WHERE id IN (${placeholders})`,
	)
		.bind(...ids)
		.all<{ id: string; source: string; chunk_index: number; text: string }>();

	const byId = new Map(results.map((r) => [r.id, r]));

	const candidates: Hit[] = matches.flatMap((m) => {
		const row = byId.get(m.id);
		return row ? [{ ...row, score: m.score }] : [];
	});

	if (!candidates.length) {
		return { hits: [], matches: matches.length, candidates: 0, reranker: "no-rows" };
	}

	try {
		const response = await rerank(
			env,
			question,
			candidates.map((c) => ({ text: c.text })),
			finalK,
		);

		const items: Hit[] = response
			.map((r, idx): Hit | null => {
				const index = typeof r.id === "number" ? r.id : idx;
				const hit = candidates[index];
				return hit ? { ...hit, rerankScore: r.score ?? 0 } : null;
			})
			.filter((h): h is Hit => h !== null)
			.sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));

		return {
			hits: items.slice(0, finalK),
			matches: matches.length,
			candidates: candidates.length,
			reranker: "ok",
			rerankerSample: response[0],
		};
	} catch (err) {
		return {
			hits: candidates.slice(0, finalK),
			matches: matches.length,
			candidates: candidates.length,
			reranker: "fallback: " + String(err),
		};
	}
}
