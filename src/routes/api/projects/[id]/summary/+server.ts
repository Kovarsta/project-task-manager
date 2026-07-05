import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectMember } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

// GET: Summary
export async function GET(event: RequestEvent) {
	const projectId = Number(event.params.id);
	await requireProjectMember(event, projectId);

	const weekAgo = new Date();
	weekAgo.setDate(weekAgo.getDate() - 7);

	const project = await prisma.project.findUnique({
		where: { id: projectId },
		include: { _count: { select: { members: true, tasks: true } } }
	});

	if (!project) throw error(404, 'Project not found');

	const [completed7d, todo, doing, done, overdue, activeTasks] = await Promise.all([
		// Tasks completed in last 7 days
		prisma.task.count({
			where: { projectId, completedAt: { gte: weekAgo } }
		}),

		// Tasks by status
		prisma.task.count({ where: { projectId, status: 'TODO' } }),
		prisma.task.count({ where: { projectId, status: 'DOING' } }),
		prisma.task.count({ where: { projectId, status: 'DONE' } }),

		// Overdue (past due and not done)
		prisma.task.count({
			where: { projectId, dueDate: { lt: new Date() }, status: { not: 'DONE' } }
		}),

		// Active tasks for urgent list
		prisma.task.findMany({
			where: { projectId, status: { not: 'DONE' } },
			include: { assignee: { select: { id: true, name: true, email: true } } }
		})
	]);

	const priorityWeight: Record<string, number> = {
		HIGHEST: 5, HIGH: 4, MEDIUM: 3, LOW: 2, LOWEST: 1
	};

	const urgentTasks = activeTasks
		.sort((a, b) => {
			if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
			if (a.dueDate) return -1;
			if (b.dueDate) return 1;
			return (priorityWeight[b.priority] ?? 3) - (priorityWeight[a.priority] ?? 3);
		})
		.slice(0, 5);

	return json({
		total: project._count.tasks,
		members: project._count.members,
		completed7d,
		todo,
		doing,
		done,
		overdue,
		urgentTasks,
		chart: {
			labels: ['To Do', 'In Progress', 'Done'],
			data: [todo, doing, done],
			colors: ['#94a3b8', '#fbbf24', '#4ade80']
		}
	});
}

