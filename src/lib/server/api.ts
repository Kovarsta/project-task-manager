import { error } from '@sveltejs/kit';

export async function serverFetch(
	event: { fetch: typeof globalThis.fetch },
	path: string,
	options?: RequestInit
) {
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
		if (!res.ok) {
			// Don't embed HTML error pages (e.g. the rate limiter's 429 page) into
			// the error message — just propagate the status so loads surface the
			// real code instead of a generic 500.
			throw error(res.status, `Request failed with status ${res.status}`);
		}
		throw error(500, `Expected JSON response but got ${contentType}`);
	}

	const data = await res.json();
	if (!res.ok) throw error(res.status, data.message ?? 'Request failed');
	return data;
}
