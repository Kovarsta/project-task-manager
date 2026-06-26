import type { LayoutServerLoad } from './$types';
import { serverFetch } from '$lib/server/api';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session) throw redirect(303, '/login');

	const project = await serverFetch(event, `/api/projects/${event.params.id}`);
	return { project, session };
};
