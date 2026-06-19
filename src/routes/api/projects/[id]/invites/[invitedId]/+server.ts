import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectAdmin } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

// DELETE: revoke invite
export async function DELETE(event: RequestEvent) {
	const token = event.params.invitedId;
	if (!token) throw error(400, 'Invalid invite link');

	const projectId = Number(event.params.id);
	const inviteId = Number(token);
	await requireProjectAdmin(event, projectId);

	const invite = await prisma.projectInvite.findUnique({
		where: { id: inviteId }
	});

	if (!invite) throw error(404, 'Invite not found');
	if (invite.projectId !== projectId) throw error(403, 'Forbidden');
	if (invite.status !== 'PENDING') throw error(400, 'Invite is no longer active');

	await prisma.projectInvite.update({
		where: { id: inviteId },
		data: { status: 'REVOKED' }
	});

	return json({ success: true });
}
