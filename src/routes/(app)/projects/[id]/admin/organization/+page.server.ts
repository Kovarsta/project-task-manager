import { error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
	const session = await locals.auth();
	const parentData = await parent();

	const membership = parentData.project.members?.find(
		(m: { user: { id: number }; isOwner: boolean }) =>
			m.user.id === Number(session?.user?.id)
	);

	if (!membership?.isOwner) throw error(403, 'Only the project owner can access organization settings');

	const projectId = Number(params.id);

	const admins = await prisma.projectMember.findMany({
		where: { projectId, isOwner: false, role: 'ADMIN' },
		include: { user: { select: { id: true, name: true, email: true } } }
	});

	return { admins };
};
