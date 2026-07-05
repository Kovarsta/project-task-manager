import type { LayoutServerLoad } from './$types';
import { serverFetch } from '$lib/server/api';
import { redirect, error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session) throw redirect(303, '/login');

	const project = await serverFetch(event, `/api/projects/${event.params.id}`);

	const myMembership = project.members?.find(
		(m: { user: { id: number }; role: string; isOwner: boolean }) =>
			m.user.id === Number(session.user.id)
	);

	if (!myMembership) throw error(403, 'Forbidden');
	if (myMembership.role !== 'ADMIN' && !myMembership.isOwner) throw error(403, 'Forbidden');

	return { project };
};

