import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectMember } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

// GET: Summary
export async function GET(event: RequestEvent) {
	const projectId = Number(event.params.id);
	await requireProjectMember(event, projectId);

	const weekAgo = new Date();
	weekAgo.setDate(weekAgo.getDate() - 7);

	const [created, completed, inProgress, overdue, activeTasks] = await Promise.all([
		// Tasks created in last 7 days
		prisma.task.count({
			where: {
				projectId,
				createdAt: { gte: weekAgo }
			}
		}),

		// Tasks completed in last 7 days
		prisma.task.count({
			where: {
				projectId,
				completedAt: { gte: weekAgo }
			}
		}),

		// Tasks currently in progress
		prisma.task.count({
			where: {
				projectId,
				status: 'DOING'
			}
		}),

		// Overdue tasks, past due date and not done
		prisma.task.count({
			where: {
				projectId,
				dueDate: { lt: new Date() },
				status: { not: 'DONE' }
			}
		}),

		// Active tasks to compute urgent list
		prisma.task.findMany({
			where: {
				projectId,
				status: { not: 'DONE' }
			},
			include: {
				assignee: { select: { id: true, name: true, email: true } }
			}
		})
	]);

	const priorityWeight: Record<string, number> = {
		HIGHEST: 5,
		HIGH: 4,
		MEDIUM: 3,
		LOW: 2,
		LOWEST: 1
	};

	const urgentTasks = activeTasks
		.sort((a, b) => {
			if (a.dueDate && b.dueDate) {
				return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
			}
			if (a.dueDate) return -1;
			if (b.dueDate) return 1;

			const pA = priorityWeight[a.priority] ?? 3;
			const pB = priorityWeight[b.priority] ?? 3;
			return pB - pA;
		})
		.slice(0, 5);

	return json({
		created,
		completed,
		inProgress,
		overdue,
		urgentTasks,

		// chart.js ready format
		chart: {
			labels: ['Created', 'Completed'],
			data: [created, completed]
		}
	});
}

