import { json, error } from '@sveltejs/kit';
import { getValidInvite } from '$lib/server/invite';
import type { RequestEvent } from '@sveltejs/kit';

// GET: Validate an invitation code
export async function GET(event: RequestEvent) {
	const token = event.params.token;
	if (!token) throw error(400, 'Invalid invite link');

	const invite = await getValidInvite(token);
	return json({
		projectName: invite.project.name,
		invitedEmail: invite.invitedEmail,
		expiresAt: invite.expiresAt,
		deactivated: !!invite.project.deactivatedAt
	});
}


