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

	const [created, completed, inProgress, overdue] = await Promise.all([
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
		})
	]);

	return json({
		created,
		completed,
		inProgress,
		overdue,

		// chart.js ready format
		chart: {
			labels: ['Created', 'Completed'],
			data: [created, completed]
		}
	});
}

