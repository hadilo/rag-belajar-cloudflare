import { SYSTEM } from "./prompt";
import type { Hit } from "./search";

export const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";

export function buildMessages(question: string, hits: Hit[]) {
	const context = hits
		.map((c, i) => `[${i + 1}] sumber: ${c.source}\n${c.text}`)
		.join("\n\n");

	return [
		{ role: "system", content: SYSTEM },
		{
			role: "user",
			content: `KONTEKS:\n${context}\n\nPERTANYAAN: ${question}`,
		},
	];
}

export function verifyCitations(answer: string, hits: Hit[]) {
	const allowed = new Set(hits.map((h) => h.source));
	const cited = [...answer.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
	const unique = [...new Set(cited)];

	return {
		cited: unique,
		invalid: unique.filter((s) => !allowed.has(s)),
		hasCitation: cited.length > 0,
	};
}

export async function answer(env: Env, question: string, hits: Hit[]) {
	const res = await env.AI.run(MODEL, {
		messages: buildMessages(question, hits),
		max_tokens: 512,
		temperature: 0.2,
	});

	const text = (res as { response?: string }).response ?? "";

	return {
		answer: text,
		sources: [...new Set(hits.map((h) => h.source))],
		...verifyCitations(text, hits),
	};
}

export async function streamAnswer(env: Env, question: string, hits: Hit[]) {
	return env.AI.run(MODEL, {
		messages: buildMessages(question, hits),
		stream: true,
		max_tokens: 512,
		temperature: 0.2,
	});
}
