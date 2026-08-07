import { handle as authHandle } from './auth';
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { gzip, brotliCompress } from 'node:zlib';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { getRedis } from '$lib/server/redis';

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);

// --- Global error handler (sanitize Prisma + unexpected errors) ---
export function handleError({
	error: e,
	status
}: {
	error: unknown;
	event: import('@sveltejs/kit').RequestEvent;
	status: number;
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

// --- Rate limiter (Redis, falls back to in-memory) ---
const WINDOW_SECONDS = Number(process.env.RATE_LIMIT_WINDOW ?? 60);
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX ?? 100);
const PAGE_CACHE_TTL_SECONDS = 30;

function hashKey(key: string): string {
	return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

function buildRateLimitKey(event: import('@sveltejs/kit').RequestEvent): string {
	const ip = event.getClientAddress() || 'unknown';
	const ua = event.request.headers.get('user-agent') ?? '';
	return `${ip}|${ua.slice(0, 64)}`;
}

type RateLimitEntry = { count: number; resetAt: number };
const fallbackMap = new Map<string, RateLimitEntry>();
const FALLBACK_MAX_ENTRIES = 50_000;
let cleanupCounter = 0;

function cleanupExpiredEntries(): void {
	const now = Date.now();
	for (const [key, entry] of fallbackMap) {
		if (now > entry.resetAt) fallbackMap.delete(key);
	}
}

const rateLimiter: Handle = async ({ event, resolve }) => {
	if (MAX_REQUESTS <= 0) return resolve(event);

	const key = hashKey(buildRateLimitKey(event));
	const redis = await getRedis();

	if (redis) {
		const redisKey = `ratelimit:${key}`;
		const count = await redis.incr(redisKey);
		if (count === 1) await redis.expire(redisKey, WINDOW_SECONDS);
		if (count > MAX_REQUESTS) throw error(429, 'Too many requests — slow down');
	} else {
		const now = Date.now();
		const entry = fallbackMap.get(key);
		if (!entry || now > entry.resetAt) {
			fallbackMap.set(key, { count: 1, resetAt: now + WINDOW_SECONDS * 1000 });
			cleanupCounter++;
			if (cleanupCounter % 50 === 0) cleanupExpiredEntries();
			if (fallbackMap.size > FALLBACK_MAX_ENTRIES) {
				cleanupExpiredEntries();
				if (fallbackMap.size > FALLBACK_MAX_ENTRIES) fallbackMap.clear();
			}
			return resolve(event);
		}
		entry.count++;
		if (entry.count > MAX_REQUESTS) throw error(429, 'Too many requests — slow down');
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

// --- Response compression + static-asset caching ---
const COMPRESSIBLE = /^(text\/|application\/(?:json|javascript|xml|svg|font|wasm))/;
const MIN_SIZE = 1024;

const compressAndCache: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// --- Cache-Control for immutable hashed assets ---
	if (event.url.pathname.startsWith('/_app/immutable/')) {
		const headers = new Headers(response.headers);
		headers.set('Cache-Control', 'public, max-age=31536000, immutable');
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers
		});
	}

	// --- Skip compression for non-compressible, small, or already-encoded ---
	const contentType = response.headers.get('content-type') || '';
	if (response.headers.has('content-encoding') || !COMPRESSIBLE.test(contentType)) {
		return response;
	}

	const accept = event.request.headers.get('accept-encoding') || '';
	if (!accept.includes('br') && !accept.includes('gzip')) return response;

	// Clone so we don't lock the original body stream for SvelteKit's internals
	const clone = response.clone();
	const body = Buffer.from(await clone.arrayBuffer());
	if (body.length < MIN_SIZE) return response;

	const headers = new Headers(response.headers);
	headers.set('Vary', 'Accept-Encoding');

	if (accept.includes('br')) {
		const compressed = await brotliAsync(body, { quality: 4 });
		headers.set('Content-Encoding', 'br');
		headers.set('Content-Length', String(compressed.length));
		return new Response(compressed, {
			status: response.status,
			statusText: response.statusText,
			headers
		});
	}

	const compressed = await gzipAsync(body);
	headers.set('Content-Encoding', 'gzip');
	headers.set('Content-Length', String(compressed.length));
	return new Response(compressed, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
};

// --- Page cache (whole SSR document, per-user) ---
const pageCache: Handle = async ({ event, resolve }) => {
	if (event.request.method !== 'GET') return resolve(event);
	if (event.url.pathname.startsWith('/api')) return resolve(event);

	const userId = event.locals.userId;
	if (!userId) return resolve(event);

	const redis = await getRedis();
	if (!redis) return resolve(event);

	const key = `page:${userId}:${event.url.pathname}${event.url.search}`;

	try {
		const hit = await redis.get(key);
		if (hit) {
			return new Response(hit, {
				status: 200,
				headers: { 'content-type': 'text/html; charset=utf-8' }
			});
		}
	} catch {
		// cache read failed — render fresh
	}

	const res = await resolve(event);
	if (res.ok) {
		const html = await res.text();
		try {
			await redis.setEx(key, PAGE_CACHE_TTL_SECONDS, html);
		} catch {
			// cache write failed — still serve the page
		}
		return new Response(html, res);
	}

	return res;
};

export const handle = sequence(rateLimiter, authHandle, authGuard, pageCache, compressAndCache);
