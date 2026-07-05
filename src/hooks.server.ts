import { handle as authHandle } from './auth';
import { sequence } from '@sveltejs/kit/hooks';
import { prisma } from '$lib/prisma';
import type { Handle } from '@sveltejs/kit';

const authGuard: Handle = async ({ event, resolve }) => {
	const session = await event.locals.auth();

	const publicRoutes = ['/login', '/auth', '/invite'];
	const isPublic = publicRoutes.some((r) => event.url.pathname.startsWith(r));

	if (!session && !isPublic) {
		return Response.redirect(new URL('/login', event.url), 303);
	}

	if (session?.user?.email && !isPublic) {
		const exists = await prisma.user.findUnique({
			where: { email: session.user.email },
			select: { id: true }
		});
		if (!exists) {
			return Response.redirect(new URL('/login', event.url), 303);
		}
	}

	return resolve(event);
};

export const handle = sequence(authHandle, authGuard);
