import type { PageServerLoad } from './$types';
import { serverFetch } from '$lib/server/api';

export const load: PageServerLoad = async (event) => {
	const summary = await serverFetch(event, `/api/projects/${event.params.id}/summary`);
	return { summary };
};
