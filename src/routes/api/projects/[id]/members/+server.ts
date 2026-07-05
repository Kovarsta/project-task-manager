import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectMember } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

// GET: Return all members
export async function GET(event: RequestEvent) {
	const projectId = Number(event.params.id);
	await requireProjectMember(event, projectId);

	const members = await prisma.projectMember.findMany({
		where: { projectId },
		include: { user: true },
		orderBy: { joinedAt: 'asc' }
	});

	const userIds = members.map((m) => m.userId);
	const taskCounts = await prisma.task.groupBy({
		by: ['assigneeId'],
		where: { projectId, assigneeId: { in: userIds } },
		_count: { id: true }
	});
	const countMap = new Map(taskCounts.map((t) => [t.assigneeId, t._count.id]));

	const result = members.map((m) => ({
		...m,
		_count: { tasks: countMap.get(m.userId) ?? 0 }
	}));

	return json(result);
}

