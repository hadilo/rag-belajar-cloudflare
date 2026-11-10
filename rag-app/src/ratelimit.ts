// Rate limiter berbasis Durable Object: satu instance per kunci (IP), jadi
// hitungannya konsisten lintas isolate. Fixed window; cukup untuk melindungi
// biaya, bukan untuk penjadwalan trafik yang adil.

export class RateLimiter {
	constructor(private state: DurableObjectState) {}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const limit = Number(url.searchParams.get("limit") ?? "30");
		const windowMs = Number(url.searchParams.get("window") ?? "60000");
		const now = Date.now();

		let record = await this.state.storage.get<{ start: number; count: number }>("window");
		if (!record || now - record.start >= windowMs) {
			record = { start: now, count: 0 };
		}

		record.count += 1;
		await this.state.storage.put("window", record);

		const resetAt = record.start + windowMs;

		return Response.json({
			allowed: record.count <= limit,
			remaining: Math.max(0, limit - record.count),
			retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
		});
	}
}
