import type { PageServerLoad } from './$types';
import { serverFetch } from '$lib/server/api';

export const load: PageServerLoad = async (event) => {
	const page = Number(event.url.searchParams.get('page') ?? 1);
	const limit = Number(event.url.searchParams.get('limit') ?? 20);
	const { users, meta } = await serverFetch(event, `/api/admin/users?page=${page}&limit=${limit}`);
	return { users, meta };
};

