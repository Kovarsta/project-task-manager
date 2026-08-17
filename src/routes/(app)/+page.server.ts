import type { PageServerLoad } from './$types';
import { serverFetch } from '$lib/server/api';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const session = event.locals.session;
	if (!session?.user?.email) throw redirect(303, '/login');

	const page = Number(event.url.searchParams.get('page') ?? 1);
	const limit = Number(event.url.searchParams.get('limit') ?? 20);
	const q = event.url.searchParams.get('q') ?? '';
	const sort = event.url.searchParams.get('sort') ?? 'createdAt';
	const order = event.url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';
	const params = new URLSearchParams({ page: String(page), limit: String(limit), sort, order });
	if (q) params.set('q', q);
	const result = await serverFetch(event, `/api/projects?${params}`);
	return { ...result, sort, order };
};
