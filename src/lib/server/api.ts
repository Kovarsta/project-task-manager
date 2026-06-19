import type { RequestEvent } from '@sveltejs/kit';

export async function serverFetch(event: RequestEvent, path: string, options?: RequestInit) {
	const res = await fetch(`${event.url.origin}${path}`, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			cookie: event.request.headers.get('cookie') ?? '',
			...options?.headers
		}
	});

	const data = await res.json();
	if (!res.ok) throw new Error(data.message ?? 'Request failed');
	return data;
}
