import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectMember } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

// GET: Return a kanban type board
export async function GET(event: RequestEvent) {
	const projectId = Number(event.params.id);
	await requireProjectMember(event, projectId);

	const tasks = await prisma.task.findMany({
		where: { projectId },
		include: {
			assignee: { select: { id: true, name: true, email: true } }
		},
		orderBy: { createdAt: 'asc' }
	});

	// Group by status
	return json({
		TODO: tasks.filter((t) => t.status === 'TODO'),
		DOING: tasks.filter((t) => t.status === 'DOING'),
		DONE: tasks.filter((t) => t.status === 'DONE')
	});
}
