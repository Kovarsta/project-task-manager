import type { LayoutServerLoad } from './$types';
import { serverFetch } from '$lib/server/api';
import { redirect, error } from '@sveltejs/kit';
import type { ProjectMember } from '$lib/type';

export const load: LayoutServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session) throw redirect(303, '/login');

	const project = await serverFetch(event, `/api/projects/${event.params.id}`);

	const isAdmin =
		project.members?.find((m: ProjectMember) => m.user.id === Number(session.user.id))?.role ===
		'ADMIN';

	if (!isAdmin) throw error(403, 'Forbidden');

	return { project };
};

