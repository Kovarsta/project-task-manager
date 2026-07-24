import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectOwner } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';
import type { RequestEvent } from '@sveltejs/kit';
import { parseIdParam } from '$lib/server/helpers';

export async function POST(event: RequestEvent) {
	const projectId = parseIdParam(event.params.id, 'projectId');
	const owner = await requireProjectOwner(event, projectId);
	const body = await event.request.json();
	const targetId = Number(body.userId);

	if (!targetId) throw error(400, 'Target user is required');
	if (targetId === owner.id) throw error(400, 'You are already the owner');

	const target = await prisma.projectMember.findUnique({
		where: { projectId_userId: { projectId, userId: targetId } },
		include: { user: { select: { id: true, name: true, email: true } } }
	});

	if (!target) throw error(404, 'Member not found');

	await prisma.$transaction([
		prisma.projectMember.update({
			where: { projectId_userId: { projectId, userId: owner.id } },
			data: { isOwner: false }
		}),
		prisma.projectMember.update({
			where: { projectId_userId: { projectId, userId: targetId } },
			data: { isOwner: true, role: 'ADMIN' }
		})
	]);

	await logActivity({
		projectId,
		userId: owner.id,
		action: 'owner_transferred',
		entityType: 'member',
		entityId: targetId,
		metadata: { from: owner.id, to: targetId, toName: target.user.name }
	});

	return json({ success: true });
}
