import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireAuth } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

async function getValidInvite(token: string) {
	const invite = await prisma.projectInvite.findUnique({
		where: { token },
		include: { project: true }
	});

	if (!invite) throw error(404, 'Invalid invite link');
	if (invite.status !== 'PENDING') throw error(400, 'Invite has already been used or revoked');
	if (invite.expiresAt < new Date()) throw error(400, 'Invite link has expired');

	return invite;
}

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

	// Already a member, just redirect
	const existing = await prisma.projectMember.findUnique({
		where: {
			projectId_userId: {
				projectId: invite.projectId,
				userId: user.id
			}
		}
	});

	if (existing) {
		await prisma.projectInvite.update({
			where: { id: invite.id },
			data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedById: user.id }
		});
		return json({ projectId: invite.projectId, alreadyMember: true });
	}

	// Accept, create membership and consume token
	await prisma.$transaction([
		prisma.projectMember.create({
			data: {
				projectId: invite.projectId,
				userId: user.id,
				role: 'MEMBER'
			}
		}),
		prisma.projectInvite.update({
			where: { id: invite.id },
			data: {
				status: 'ACCEPTED',
				acceptedAt: new Date(),
				acceptedById: user.id
			}
		})
	]);

	return json({ projectId: invite.projectId, alreadyMember: false });
}
