import type { LayoutServerLoad } from './$types';
import { serverFetch } from '$lib/server/api';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session) throw redirect(303, '/login');

	const project = await serverFetch(event, `/api/projects/${event.params.id}`);

	// Load members for admin features (modals etc.) — only when the user is admin.
	let members: unknown[] = [];
	const myMembership = project.members?.[0];
	if (myMembership && (myMembership.role === 'ADMIN' || myMembership.isOwner)) {
		try {
			const res = await event.fetch(`/api/projects/${event.params.id}/members?limit=200`);
			if (res.ok) {
				const body = await res.json();
				members = body.members;
			}
		} catch {
			// non-critical — modals will show just the current user
		}
	}

	return { project, session, members };
};
