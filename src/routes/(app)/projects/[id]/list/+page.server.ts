import type { PageServerLoad } from './$types';
import { serverFetch } from '$lib/server/api';
import type { ProjectMember } from '$lib/type';

const ALLOWED_SORTS = ['title', 'status', 'priority', 'dueDate', 'createdAt'];

export const load: PageServerLoad = async (event) => {
	const session = event.locals.session;

	const page = Number(event.url.searchParams.get('page') ?? 1);
	const limit = Number(event.url.searchParams.get('limit') ?? 20);
	const q = event.url.searchParams.get('q') ?? '';
	const rawSort = event.url.searchParams.get('sort');
	const rawOrder = event.url.searchParams.get('order');
	const sort = rawSort && ALLOWED_SORTS.includes(rawSort) ? rawSort : 'createdAt';
	const order = rawOrder === 'asc' ? 'asc' : 'desc';

	const params = new URLSearchParams({ page: String(page), limit: String(limit), sort, order });
	if (q) params.set('q', q);

	const [tasksRes, project] = await Promise.all([
		serverFetch(event, `/api/projects/${event.params.id}/tasks?${params}`),
		serverFetch(event, `/api/projects/${event.params.id}`)
	]);

	const isAdmin =
		project.members?.find((m: ProjectMember) => m.user.id === Number(session?.user?.id))?.role ===
		'ADMIN';

	return {
		tasks: tasksRes.tasks,
		meta: tasksRes.meta,
		project,
		isAdmin,
		query: q,
		sort,
		order
	};
};
