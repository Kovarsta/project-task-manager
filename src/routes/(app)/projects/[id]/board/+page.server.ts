import type { PageServerLoad } from './$types';
import { serverFetch } from '$lib/server/api';
import type { ProjectMember } from '$lib/type';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();

	const [kanban, project] = await Promise.all([
		serverFetch(event, `/api/projects/${event.params.id}/kanban`),
		serverFetch(event, `/api/projects/${event.params.id}`)
	]);

	const isAdmin =
		project.members?.find((m: ProjectMember) => m.user.id === Number(session?.user?.id))?.role ===
		'ADMIN';

	return { kanban, project, isAdmin };
};
