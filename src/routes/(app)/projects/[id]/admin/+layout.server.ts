import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async (event) => {
	const parentData = await event.parent();
	const { project, session } = parentData;
	if (!session) throw error(401, 'Unauthorized');

	const myMembership = project.members?.find(
		(m: { user: { id: number }; role: string; isOwner: boolean }) =>
			m.user.id === Number(session.user.id)
	);

	if (!myMembership) throw error(403, 'Forbidden');
	if (myMembership.role !== 'ADMIN' && !myMembership.isOwner) throw error(403, 'Forbidden');

	return { project };
};
