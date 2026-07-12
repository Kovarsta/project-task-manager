export async function serverFetch(event: { fetch: typeof globalThis.fetch }, path: string, options?: RequestInit) {
	const res = await event.fetch(path, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...options?.headers
		}
	});

	const data = await res.json();
	if (!res.ok) throw new Error(data.message ?? 'Request failed');
	return data;
}
