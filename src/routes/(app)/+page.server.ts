import type { PageServerLoad } from './$types';
import { serverFetch } from '$lib/server/api';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.email) throw redirect(303, '/login');

	const page = Number(event.url.searchParams.get('page') ?? 1);
	const limit = Number(event.url.searchParams.get('limit') ?? 20);
	return await serverFetch(event, `/api/projects?page=${page}&limit=${limit}`);
};
