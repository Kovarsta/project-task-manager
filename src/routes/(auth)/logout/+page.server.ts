import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	cookies.delete('authjs.session-token', { path: '/' });
	cookies.delete('authjs.csrf-token', { path: '/' });
	cookies.delete('authjs.callback-url', { path: '/' });

	throw redirect(302, '/login');
};
