import type { PageServerLoad } from './$types';
import { serverFetch } from '$lib/server/api';

export const load: PageServerLoad = async (event) => {
	const page = Number(event.url.searchParams.get('page') ?? 1);
	const limit = Number(event.url.searchParams.get('limit') ?? 20);
	const q = event.url.searchParams.get('q') ?? '';
	const params = new URLSearchParams({ page: String(page), limit: String(limit) });
	if (q) params.set('q', q);
	const { projects, meta } = await serverFetch(event, `/api/admin/projects?${params}`);
	return { projects, meta, q };
};
