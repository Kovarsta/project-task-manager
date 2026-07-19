export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export async function serverFetch(event: { fetch: typeof globalThis.fetch }, path: string, options?: RequestInit) {
	const isGet = !options?.method || options.method === 'GET';
	const res = await event.fetch(path, {
		...options,
		headers: {
			...(isGet ? {} : { 'Content-Type': 'application/json' }),
			...options?.headers
		}
	});

	const contentType = res.headers.get('content-type') ?? '';
	if (!contentType.includes('json')) {
		const text = await res.text();
		if (!res.ok) throw new ApiError(res.status, text || `Request failed with status ${res.status}`);
		throw new ApiError(500, `Expected JSON response but got ${contentType}`);
	}

	const data = await res.json();
	if (!res.ok) throw new ApiError(res.status, data.message ?? 'Request failed');
	return data;
}
