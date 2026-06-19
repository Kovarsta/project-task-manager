import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectMember } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

// POST: Leaving
export async function POST(event: RequestEvent) {
	const projectId = Number(event.params.id);
	const { user, member } = await requireProjectMember(event, projectId);

	// If user is admin, check they are not the last admin
	if (member.role === 'ADMIN') {

		const adminCount = await prisma.projectMember.count({
			where: {
				projectId,
				role: 'ADMIN'
			}
		});

		if (adminCount <= 1) {
			throw error(400, 'You are the last admin. Assign another admin before leaving.');
		}
	}

	// Unassign their tasks
	await prisma.$transaction([
		prisma.task.updateMany({
			where: { projectId, assigneeId: user.id },
			data: { assigneeId: null }
		}),
		prisma.projectMember.delete({
			where: {
				projectId_userId: {
					projectId,
					userId: user.id
				}
			}
		})
	]);

	return json({ success: true });
}
