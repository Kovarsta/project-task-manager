import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();

	// Not logged in, redirect to login, come back here after
	if (!session) {
		throw redirect(307, `/login?redirectTo=/invite/${event.params.token}`);
	}

	// Validate the token
	const res = await fetch(`${event.url.origin}/api/invites/${event.params.token}`, {
		headers: { cookie: event.request.headers.get('cookie') ?? '' }
	});

	const data = await res.json();

	if (!res.ok) {
		return { error: data.message, projectName: null, invitedEmail: null };
	}

	// Email mismatch check happens here too, before showing accept screen
	if (session.user.email.toLowerCase() !== data.invitedEmail.toLowerCase()) {
		return {
			error: `This invite was sent to ${data.invitedEmail}. You're signed in as ${session.user.email}.`,
			projectName: null,
			invitedEmail: data.invitedEmail
		};
	}

	return { ...data, error: null };
};

