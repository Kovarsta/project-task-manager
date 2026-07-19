import type { PageServerLoad } from './$types';
import type { ProjectMember } from '$lib/type';

export const load: PageServerLoad = async (event) => {
	const parentData = await event.parent();
	const { project, session } = parentData;

	const isAdmin =
		project.members?.find((m: ProjectMember) => m.user.id === Number(session?.user?.id))
			?.role === 'ADMIN';

	return { kanban: null, project, isAdmin };
};
