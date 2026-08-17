import type { LayoutServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async (event) => {
	const session = event.locals.session;
	if (!session) throw redirect(303, '/login');
	if (!session.user.isSuperAdmin) throw error(403, 'Forbidden');

	return { session };
};
