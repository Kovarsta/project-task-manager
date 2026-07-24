import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectAdmin, requireProjectMember } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';
import type { RequestEvent } from '@sveltejs/kit';
import { parseIdParam } from '$lib/server/helpers';

//Delete: Remove an INVITED user from the project
export async function DELETE(event: RequestEvent) {
	const projectId = parseIdParam(event.params.id, 'projectId');
	const targetId = parseIdParam(event.params.userId, 'userId');
	const admin = await requireProjectAdmin(event, projectId);

	if (admin.id === targetId) {
		throw error(400, 'Use leave project instead');
	}

	// Only allows so if they are a member already
	const target = await prisma.projectMember.findUnique({
		where: { projectId_userId: { projectId, userId: targetId } },
		include: { user: { select: { id: true, name: true, email: true } } }
	});

	if (!target) throw error(404, 'Member not found');
	if (target.isOwner) throw error(403, 'Cannot remove the project owner');
	if (target.role === 'ADMIN') throw error(403, 'Cannot remove another admin');

	await prisma.projectMember.delete({
		where: { projectId_userId: { projectId, userId: targetId } }
	});

	await logActivity({
		projectId,
		userId: admin.id,
		action: 'member_removed',
		entityType: 'member',
		entityId: targetId,
		metadata: { name: target.user.name }
	});

	return json({ success: true });
}

// GET: Search
export async function GET(event: RequestEvent) {
	const projectId = parseIdParam(event.params.id, 'projectId');
	await requireProjectMember(event, projectId);

	const q = event.url.searchParams.get('q')?.trim();
	if (!q || q.length < 2) return json([]);

	const users = await prisma.user.findMany({
		where: {
			deactivatedAt: null,
			OR: [
				{ name: { contains: q, mode: 'insensitive' } },
				{ email: { contains: q, mode: 'insensitive' } }
			]
		},
		select: { id: true, name: true, email: true },
		take: 5
	});

	return json(users);
}

// PATCH: Use to elavate someone to a higher permission
export async function PATCH(event: RequestEvent) {
	const projectId = parseIdParam(event.params.id, 'projectId');
	const targetId = parseIdParam(event.params.userId, 'userId');
	const user = await requireProjectAdmin(event, projectId);

	const body = await event.request.json();
	if (body.role !== 'ADMIN' && body.role !== 'MEMBER') {
		throw error(400, 'Role must be ADMIN or MEMBER');
	}

	const target = await prisma.projectMember.findUnique({
		where: { projectId_userId: { projectId, userId: targetId } },
		include: { user: { select: { id: true, name: true, email: true } } }
	});

	if (!target) throw error(404, 'Member not found');
	if (target.isOwner) throw error(403, 'Cannot change the project owner role');

	if (target.role === 'ADMIN' && body.role === 'MEMBER') {
		if (user.id !== targetId) {
			throw error(403, 'You can only demote yourself');
		}
		const adminCount = await prisma.projectMember.count({
			where: { projectId, OR: [{ role: 'ADMIN' }, { isOwner: true }] }
		});
		if (adminCount <= 1) {
			throw error(400, 'Cannot demote the last admin');
		}
	}

	const updated = await prisma.projectMember.update({
		where: { projectId_userId: { projectId, userId: targetId } },
		data: { role: body.role },
		include: { user: { select: { id: true, name: true, email: true } } }
	});

	await logActivity({
		projectId,
		userId: user.id,
		action: 'member_role_changed',
		entityType: 'member',
		entityId: targetId,
		metadata: { name: target.user.name, oldRole: target.role, newRole: body.role }
	});

	return json(updated);
}
