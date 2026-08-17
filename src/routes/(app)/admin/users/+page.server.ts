import type { PageServerLoad } from './$types';
import { serverFetch } from '$lib/server/api';

export const load: PageServerLoad = async (event) => {
	const page = Number(event.url.searchParams.get('page') ?? 1);
	const limit = Number(event.url.searchParams.get('limit') ?? 20);
	const q = event.url.searchParams.get('q') ?? '';
	const sort = event.url.searchParams.get('sort') ?? 'name';
	const order = event.url.searchParams.get('order') ?? 'asc';
	const roleParam = event.url.searchParams.get('role');
	const role = roleParam === 'super' || roleParam === 'user' ? roleParam : '';
	const params = new URLSearchParams({ page: String(page), limit: String(limit), sort, order });
	if (q) params.set('q', q);
	if (role) params.set('role', role);
	const { users, meta } = await serverFetch(event, `/api/admin/users?${params}`);
	return { users, meta, q, sort, order, role };
};
