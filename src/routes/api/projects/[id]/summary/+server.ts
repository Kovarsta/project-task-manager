import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectMember } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { parseIdParam } from '$lib/server/helpers';
import { cached } from '$lib/server/cache';

// GET: Summary
export async function GET(event: RequestEvent) {
	const projectId = parseIdParam(event.params.id, 'projectId');
	await requireProjectMember(event, projectId);

	const data = await cached(`project:summary:${projectId}`, 30, async () => {
		const weekAgo = new Date();
		weekAgo.setDate(weekAgo.getDate() - 7);

		const project = await prisma.project.findUnique({
			where: { id: projectId },
			include: { _count: { select: { members: true, tasks: true } } }
		});

		if (!project) throw error(404, 'Project not found');

		const [completed7d, statusCounts, overdue, activeTasks, recentActivity] = await Promise.all([
			prisma.task.count({
				where: { projectId, completedAt: { gte: weekAgo } }
			}),
			prisma.task.groupBy({
				by: ['status'],
				where: { projectId },
				_count: { _all: true }
			}),
			prisma.task.count({
				where: { projectId, dueDate: { lt: new Date() }, status: { not: 'DONE' } }
			}),
			prisma.task.findMany({
				where: { projectId, status: { not: 'DONE' } },
				include: { assignee: { select: { id: true, name: true, email: true } } },
				orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
				take: 5
			}),
			prisma.activityLog.findMany({
				where: { projectId },
				include: { user: { select: { id: true, name: true } } },
				orderBy: { createdAt: 'desc' },
				take: 5
			})
		]);

		const statusMap = new Map(statusCounts.map((s) => [s.status, s._count._all]));
		const todo = statusMap.get('TODO') ?? 0;
		const doing = statusMap.get('DOING') ?? 0;
		const done = statusMap.get('DONE') ?? 0;

		return {
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
		};
	});

	return json(data);
}
