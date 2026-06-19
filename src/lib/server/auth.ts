import { prisma } from '../prisma';
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

// TODO: Translate all of the errors into Vietnamese
export async function requireAuth(event: RequestEvent) {
	const session = await event.locals.auth();
	if (!session?.user?.email) throw error(401, 'Unauthorized');

	const user = await prisma.user.findUnique({
		where: { email: session.user.email }
	});

	if (!user) throw error(401, 'Unauthorized');
	return user;
}

export async function requireSuperAdmin(event: RequestEvent) {
	const user = await requireAuth(event);
	if (!user.isSuperAdmin) throw error(403, 'Forbidden');
	return user;
}

export async function requireProjectAdmin(event: RequestEvent, projectId: number) {
	const user = await requireAuth(event);

	const member = await prisma.projectMember.findUnique({
		where: {
			projectId_userId: {
				projectId,
				userId: user.id
			}
		}
	});

	if (!member) throw error(403, 'Forbidden');
	if (member.role !== 'ADMIN') throw error(403, 'Forbidden');
	return user;
}

export async function requireProjectMember(event: RequestEvent, projectId: number) {
	const user = await requireAuth(event);

	const member = await prisma.projectMember.findUnique({
		where: {
			projectId_userId: {
				projectId,
				userId: user.id
			}
		}
	});

	if (!member) throw error(403, 'Forbidden');
	return { user, member };
}
