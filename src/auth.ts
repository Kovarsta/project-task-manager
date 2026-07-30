import { SvelteKitAuth } from '@auth/sveltekit';
import GitHub from '@auth/sveltekit/providers/github';
import MicrosoftEntraID from '@auth/sveltekit/providers/microsoft-entra-id';
import { prisma } from '$lib/prisma';
import { env } from '$env/dynamic/private';
import { getRedis } from '$lib/server/redis';
import { cached } from '$lib/server/cache';

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

export async function invalidateSessionCache(email: string): Promise<void> {
	const redis = await getRedis();
	if (!redis) return;
	await redis.del(`auth:session:${email}`);
}

export const { handle, signIn, signOut } = SvelteKitAuth({
	providers: providers,
	trustHost: true,

	callbacks: {
		async session({ session }) {
			if (!session.user.email) return session;

			const dbUser = await cached(`auth:session:${session.user.email}`, 30, async () => {
				return prisma.user.findUnique({
					where: { email: session.user.email },
					select: { id: true, isSuperAdmin: true, deactivatedAt: true }
				});
			});

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
