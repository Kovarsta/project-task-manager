import type { PageServerLoad } from './$types';
import { serverFetch } from '$lib/server/api';

export const load: PageServerLoad = async (event) => {
	const page = Number(event.url.searchParams.get('page') ?? 1);
	const limit = Number(event.url.searchParams.get('limit') ?? 20);
	const q = event.url.searchParams.get('q') ?? '';
	const role = event.url.searchParams.get('role') ?? '';

	const [membersRes, invites] = await Promise.all([
		serverFetch(event, `/api/projects/${event.params.id}/members?page=${page}&limit=${limit}&q=${encodeURIComponent(q)}&role=${role}`),
		serverFetch(event, `/api/projects/${event.params.id}/invites`)
	]);

	return {
		members: membersRes.members,
		meta: membersRes.meta,
		invites: invites.invites
	};
};