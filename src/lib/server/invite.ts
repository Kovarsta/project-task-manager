import { error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';

export async function getValidInvite(token: string) {
	const invite = await prisma.projectInvite.findUnique({
		where: { token },
		include: { project: true }
	});

	if (!invite) throw error(404, 'Invalid invite link');
	if (invite.status !== 'PENDING') throw error(400, 'Invite has already been used or revoked');
	if (invite.expiresAt < new Date()) throw error(400, 'Invite link has expired');
	if (invite.project.deactivatedAt) throw error(400, 'This project is no longer active');

	return invite;
}
