import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireAuth } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';
import { getValidInvite } from '$lib/server/invite';
import type { RequestEvent } from '@sveltejs/kit';

// POST: Accept an invitation code
export async function POST(event: RequestEvent) {
	const token = event.params.token;
	if (!token) throw error(400, 'Invalid invite link');

	const user = await requireAuth(event);
	const invite = await getValidInvite(token);

	// Email must match
	if (user.email.toLowerCase() !== invite.invitedEmail.toLowerCase()) {
		throw error(403, 'This invite was sent to a different email address');
	}

	// Accept — membership check + create inside a transaction to avoid TOCTOU
	const result = await prisma.$transaction(async (tx) => {
		const existing = await tx.projectMember.findUnique({
			where: {
				projectId_userId: {
					projectId: invite.projectId,
					userId: user.id
				}
			}
		});

		if (existing) {
			await tx.projectInvite.update({
				where: { id: invite.id },
				data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedById: user.id }
			});
			return { projectId: invite.projectId, alreadyMember: true };
		}

		await tx.projectMember.create({
			data: {
				projectId: invite.projectId,
				userId: user.id,
				role: 'MEMBER'
			}
		});

		await tx.projectInvite.update({
			where: { id: invite.id },
			data: {
				status: 'ACCEPTED',
				acceptedAt: new Date(),
				acceptedById: user.id
			}
		});

		return { projectId: invite.projectId, alreadyMember: false };
	});

	if (!result.alreadyMember) {
		await logActivity({
			projectId: invite.projectId,
			userId: user.id,
			action: 'member_joined',
			entityType: 'member',
			entityId: user.id,
			metadata: { name: user.name, email: user.email }
		});
	}

	return json(result);
}
