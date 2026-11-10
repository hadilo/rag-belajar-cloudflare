import { SYSTEM } from "./prompt";
import { generate, generateStream } from "./ai";
import { assessAnswer } from "./grounding";
import type { Hit } from "./search";

export function buildMessages(question: string, hits: Hit[]) {
	const context = hits
		.map((c, i) => `Konteks ${i + 1} (${c.source}):\n${c.text}`)
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
	return assessAnswer(answer, [...new Set(hits.map((h) => h.source))]);
}

export async function answer(env: Env, question: string, hits: Hit[]) {
	const text = await generate(env, buildMessages(question, hits));

	return {
		answer: text,
		sources: [...new Set(hits.map((h) => h.source))],
		...verifyCitations(text, hits),
	};
}

export async function streamAnswer(env: Env, question: string, hits: Hit[]) {
	return generateStream(env, buildMessages(question, hits));
}
