// Tipe hasil generate `wrangler types` untuk model AI tidak lengkap: input
// reranker kehilangan properti `query`, dan output embedding berupa union.
// Semua cast diisolasi di sini supaya kode domain tetap bertipe.

export const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";

export type ChatMessage = { role: string; content: string };
export type EmbeddingOutput = { shape?: number[]; data?: number[][] };
export type RerankItem = { id?: number; score?: number };

type AnyRun = (model: string, input: unknown, options?: unknown) => Promise<unknown>;

function run(env: Env): AnyRun {
	// `.bind` penting: env.AI.run bergantung pada `this`, dan melepasnya dari
	// objek akan gagal saat runtime meski lolos typecheck.
	return env.AI.run.bind(env.AI) as unknown as AnyRun;
}

export async function embed(env: Env, text: string[]): Promise<number[][]> {
	const out = (await run(env)("@cf/baai/bge-m3", { text })) as EmbeddingOutput;
	return out.data ?? [];
}

export async function rerank(
	env: Env,
	query: string,
	contexts: { text: string }[],
	topK: number,
): Promise<RerankItem[]> {
	const out = (await run(env)("@cf/baai/bge-reranker-base", {
		query,
		contexts,
		top_k: topK,
	})) as { response?: RerankItem[] };

	return out.response ?? [];
}

export async function generate(
	env: Env,
	messages: ChatMessage[],
	maxTokens = 512,
): Promise<string> {
	const out = (await run(env)(MODEL, {
		messages,
		max_tokens: maxTokens,
		temperature: 0.2,
	})) as { response?: string };

	return out.response ?? "";
}

export async function generateStream(
	env: Env,
	messages: ChatMessage[],
	maxTokens = 512,
): Promise<ReadableStream> {
	const out = await run(env)(MODEL, {
		messages,
		stream: true,
		max_tokens: maxTokens,
		temperature: 0.2,
	});

	return out as ReadableStream;
}
