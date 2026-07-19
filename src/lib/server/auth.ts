import { prisma } from '../prisma';
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

// TODO: Translate all of the errors into Vietnamese
export async function requireAuth(event: RequestEvent) {
	if (event.locals.userId) {
		const user = await prisma.user.findUnique({
			where: { id: event.locals.userId }
		});
		if (user) return user;
	}

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

/**
 * Single-query lookup: finds the user (via `event.locals.userId` or session)
 * and their project membership in one call.
 */
async function getAuthAndMember(event: RequestEvent, projectId: number) {
	let userId = event.locals.userId;

	if (!userId) {
		const session = await event.locals.auth();
		if (!session?.user?.email) throw error(401, 'Unauthorized');
		const user = await prisma.user.findUnique({ where: { email: session.user.email } });
		if (!user) throw error(401, 'Unauthorized');
		userId = user.id;
	}

	// Single query: fetch user and their membership for this project
	const result = await prisma.user.findUnique({
		where: { id: userId },
		include: {
			memberships: {
				where: { projectId },
				include: { project: { select: { deactivatedAt: true } } }
			}
		}
	});

	if (!result) throw error(401, 'Unauthorized');
	const member = result.memberships[0];
	if (!member) throw error(403, 'Forbidden');
	if (member.project.deactivatedAt) throw error(404, 'Project not found');

	return { user: result, member };
}

export async function requireProjectAdmin(event: RequestEvent, projectId: number) {
	const { user, member } = await getAuthAndMember(event, projectId);
	if (member.role !== 'ADMIN' && !member.isOwner) throw error(403, 'Forbidden');
	return user;
}

export async function requireProjectOwner(event: RequestEvent, projectId: number) {
	const { user, member } = await getAuthAndMember(event, projectId);
	if (!member.isOwner) throw error(403, 'Forbidden');
	return user;
}

export async function requireProjectMember(event: RequestEvent, projectId: number) {
	const { user, member } = await getAuthAndMember(event, projectId);
	return { user, member };
}
