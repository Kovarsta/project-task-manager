import type { PageServerLoad } from '../$types';
import { serverFetch } from '$lib/server/api';

export const load: PageServerLoad = async (event) => {
	const [members, invites] = await Promise.all([
		serverFetch(event, `/api/projects/${event.params.id}/members`),
		serverFetch(event, `/api/projects/${event.params.id}/invites`)
	]);
	return { members, invites };
};
