import { handle as authHandle } from './auth';
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

// --- Global error handler (sanitize Prisma + unexpected errors) ---
export function handleError({
	error: e,
	status
}: {
	error: unknown;
	event: import('@sveltejs/kit').RequestEvent;
	status?: number;
	message: string;
}) {
	// 404s (favicon, bots, etc.) — no logging needed
	if (status === 404) {
		return { message: 'Not Found' };
	}

	// Prisma known request errors leak the query or constraint name
	const prismaErr = e as { code?: string };
	if (prismaErr.code?.startsWith?.('P')) {
		return {
			message: 'A database error occurred. Please try again later.'
		};
	}

	console.error('Unhandled error:', e);
	return { message: 'Internal server error' };
}

// --- Rate limiter (in-memory sliding window) ---
type RateLimitEntry = { count: number; resetAt: number };
const rateLimitMap = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;
let cleanupCounter = 0;

function buildRateLimitKey(event: import('@sveltejs/kit').RequestEvent): string {
	const forwarded = event.request.headers.get('x-forwarded-for');
	const ip = forwarded?.split(',')[0]?.trim() ?? event.getClientAddress() ?? 'unknown';
	const ua = event.request.headers.get('user-agent') ?? '';
	return `${ip}|${ua.slice(0, 64)}`;
}

function cleanupExpiredEntries(): void {
	const now = Date.now();
	for (const [key, entry] of rateLimitMap) {
		if (now > entry.resetAt) rateLimitMap.delete(key);
	}
}

const rateLimiter: Handle = async ({ event, resolve }) => {
	const key = buildRateLimitKey(event);
	const now = Date.now();
	const entry = rateLimitMap.get(key);

	if (!entry || now > entry.resetAt) {
		rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });

		cleanupCounter++;
		if (cleanupCounter % 50 === 0) cleanupExpiredEntries();

		return resolve(event);
	}

	entry.count++;
	if (entry.count > MAX_REQUESTS) {
		throw error(429, 'Too many requests — slow down');
	}

	return resolve(event);
};

// --- Auth guard ---
const publicRoutes = ['/login', '/logout', '/auth', '/invite'];

const authGuard: Handle = async ({ event, resolve }) => {
	const session = await event.locals.auth();

	const isPublic = publicRoutes.some((r) => event.url.pathname.startsWith(r));

	if (!session && !isPublic) {
		return Response.redirect(new URL('/login', event.url), 303);
	}

	if (session?.user?.id && !isPublic) {
		event.locals.userId = Number(session.user.id);
	}

	return resolve(event);
};

export const handle = sequence(rateLimiter, authHandle, authGuard);
