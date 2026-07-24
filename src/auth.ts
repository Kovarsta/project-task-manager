import { SvelteKitAuth } from '@auth/sveltekit';
import GitHub from '@auth/sveltekit/providers/github';
import MicrosoftEntraID from '@auth/sveltekit/providers/microsoft-entra-id';
import { prisma } from '$lib/prisma';
import { env } from '$env/dynamic/private';

const providers = [];
if (env.USE_MOCK_SSO) {
	providers.push(
		GitHub({
			clientId: env.AUTH_GITHUB_ID,
			clientSecret: env.AUTH_GITHUB_SECRET
		})
	);
} else {
	providers.push(
		MicrosoftEntraID({
			clientId: env.AUTH_MICROSOFT_ENTRA_ID_ID,
			clientSecret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
			issuer: env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
		})
	);
}

// --- In-memory session cache (avoids DB hit on every request) ---
type CachedUser = { id: number; isSuperAdmin: boolean; deactivatedAt: Date | null } | null;
const sessionCache = new Map<string, { data: CachedUser; expiry: number }>();
const SESSION_TTL = 30_000;

function getSessionCached(email: string): CachedUser | undefined {
	const entry = sessionCache.get(email);
	if (!entry) return undefined;
	if (Date.now() > entry.expiry) {
		sessionCache.delete(email);
		return undefined;
	}
	return entry.data;
}

function setSessionCached(email: string, data: CachedUser): void {
	if (sessionCache.size > 2000) {
		const now = Date.now();
		for (const [k, v] of sessionCache) {
			if (now > v.expiry) sessionCache.delete(k);
		}
	}
	sessionCache.set(email, { data, expiry: Date.now() + SESSION_TTL });
}

export function invalidateSessionCache(email: string): void {
	sessionCache.delete(email);
}

export const { handle, signIn, signOut } = SvelteKitAuth({
	providers: providers,
	trustHost: true,

	callbacks: {
		async session({ session }) {
			if (!session.user.email) return session;

			let dbUser = getSessionCached(session.user.email);
			if (dbUser === undefined) {
				dbUser = await prisma.user.findUnique({
					where: { email: session.user.email },
					select: { id: true, isSuperAdmin: true, deactivatedAt: true }
				});
				setSessionCached(session.user.email, dbUser);
			}

			if (dbUser) {
				if (dbUser.deactivatedAt) return session;
				session.user.id = String(dbUser.id);
				session.user.isSuperAdmin = dbUser.isSuperAdmin;
			}

			return session;
		},
		async signIn({ user }) {
			if (!user.email) return false;

			const existing = await prisma.user.findUnique({
				where: { email: user.email },
				select: { id: true, deactivatedAt: true }
			});

			if (existing?.deactivatedAt) return false;

			const isFirstUser = !existing && (await prisma.user.count()) === 0;

			await prisma.user.upsert({
				where: { email: user.email },
				update: { name: user.name ?? user.email },
				create: {
					email: user.email,
					name: user.name ?? user.email,
					microsoftId: user.id!,
					isSuperAdmin: isFirstUser
				}
			});

			return true;
		}
	},
	pages: {
		signIn: '/login'
	}
});
