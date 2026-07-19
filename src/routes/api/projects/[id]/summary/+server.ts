import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectMember } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { parseIdParam } from '$lib/server/helpers';

// GET: Summary
export async function GET(event: RequestEvent) {
	const projectId = parseIdParam(event.params.id, 'projectId');
	await requireProjectMember(event, projectId);

	const weekAgo = new Date();
	weekAgo.setDate(weekAgo.getDate() - 7);

	const project = await prisma.project.findUnique({
		where: { id: projectId },
		include: { _count: { select: { members: true, tasks: true } } }
	});

	if (!project) throw error(404, 'Project not found');

	const [completed7d, todo, doing, done, overdue, activeTasks, recentActivity] = await Promise.all([
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
			include: { assignee: { select: { id: true, name: true, email: true } } },
			orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
			take: 5
		}),

		// Recent activity
		prisma.activityLog.findMany({
			where: { projectId },
			include: { user: { select: { id: true, name: true } } },
			orderBy: { createdAt: 'desc' },
			take: 5
		})
	]);

	return json({
		total: project._count.tasks,
		members: project._count.members,
		completed7d,
		todo,
		doing,
		done,
		overdue,
		urgentTasks: activeTasks,
		recentActivity,
		chart: {
			labels: ['To Do', 'In Progress', 'Done'],
			data: [todo, doing, done],
			colors: ['#94a3b8', '#fbbf24', '#4ade80']
		}
	});
}
