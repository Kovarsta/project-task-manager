import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getValidInvite } from '$lib/server/invite';
import type { HttpError } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();

	if (!session) {
		throw redirect(307, `/login?redirectTo=/invite/${event.params.token}`);
	}

	try {
		const invite = await getValidInvite(event.params.token!);

		if (session.user.email?.toLowerCase() !== invite.invitedEmail.toLowerCase()) {
			return {
				error: `This invite was sent to ${invite.invitedEmail}. You're signed in as ${session.user.email}.`,
				projectName: null as string | null,
				invitedEmail: invite.invitedEmail
			};
		}

		return {
			projectName: invite.project.name,
			invitedEmail: invite.invitedEmail,
			expiresAt: invite.expiresAt,
			deactivated: !!invite.project.deactivatedAt,
			error: null as string | null
		};
	} catch (e) {
		const err = e as HttpError;
		return {
			error: err.body?.message ?? 'Invalid invite link',
			projectName: null as string | null,
			invitedEmail: null as string | null
		};
	}
};
