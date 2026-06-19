import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectAdmin } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';

//Delete: Remove an INVITED user from the project
export async function DELETE(event: RequestEvent) {
	const projectId = Number(event.params.id);
	const targetId = Number(event.params.userId);
	const admin = await requireProjectAdmin(event, projectId);

	if (admin.id === targetId) {
		throw error(400, 'Use leave project instead');
	}

	// Only allows so if they are a member already
	const target = await prisma.projectMember.findUnique({
		where: { projectId_userId: { projectId, userId: targetId } }
	});

	if (!target) throw error(404, 'Member not found');
	if (target.role === 'ADMIN') throw error(403, 'Cannot remove another admin');

	await prisma.$transaction([
		prisma.task.updateMany({
			where: { projectId, assigneeId: targetId },
			data: { assigneeId: null }
		}),
		prisma.projectMember.delete({
			where: { projectId_userId: { projectId, userId: targetId } }
		})
	]);

	return json({ success: true });
}

// GET: Search
export async function GET(event: RequestEvent) {
	await requireAuth(event);

	const q = event.url.searchParams.get('q')?.trim();
	if (!q || q.length < 2) return json([]);

	const users = await prisma.user.findMany({
		where: {
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
	const projectId = Number(event.params.id);
	const targetId = Number(event.params.userId);
	await requireProjectAdmin(event, projectId);

	const body = await event.request.json();
	if (body.role !== 'ADMIN' && body.role !== 'MEMBER') {
		throw error(400, 'Role must be ADMIN or MEMBER');
	}

	const target = await prisma.projectMember.findUnique({
		where: { projectId_userId: { projectId, userId: targetId } }
	});

	if (!target) throw error(404, 'Member not found');

	if (target.role === 'ADMIN' && body.role === 'MEMBER') {
		const adminCount = await prisma.projectMember.count({
			where: { projectId, role: 'ADMIN' }
		});
		if (adminCount <= 1) {
			throw error(400, 'Cannot demote the last admin');
		}
	}

	const updated = await prisma.projectMember.update({
		where: { projectId_userId: { projectId, userId: targetId } },
		data: { role: body.role },
		include: { user: true }
	});

	return json(updated);
}
