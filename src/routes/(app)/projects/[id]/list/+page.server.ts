import type { PageServerLoad } from './$types';
import { serverFetch } from '$lib/server/api';
import type { ProjectMember } from '$lib/type';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();

	const page = Number(event.url.searchParams.get('page') ?? 1);
	const limit = Number(event.url.searchParams.get('limit') ?? 20);

	const [tasksRes, project] = await Promise.all([
		serverFetch(event, `/api/projects/${event.params.id}/tasks?page=${page}&limit=${limit}`),
		serverFetch(event, `/api/projects/${event.params.id}`)
	]);

	const isAdmin =
		project.members?.find((m: ProjectMember) => m.user.id === Number(session?.user?.id))?.role ===
		'ADMIN';

	return {
		tasks: tasksRes.tasks,
		meta: tasksRes.meta,
		project,
		isAdmin
	};
};

