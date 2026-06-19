import { SvelteKitAuth } from '@auth/sveltekit';
import GitHub from '@auth/sveltekit/providers/github';
import MicrosoftEntraID from '@auth/sveltekit/providers/microsoft-entra-id';
import { prisma } from '$lib/prisma';
import {
	AUTH_GITHUB_ID,
	AUTH_GITHUB_SECRET,
	USE_MOCK_SSO,
	AUTH_MICROSOFT_ENTRA_ID_ID,
	AUTH_MICROSOFT_ENTRA_ID_SECRET,
	AUTH_MICROSOFT_ENTRA_ID_ISSUER
} from '$env/static/private';

const providers = [];
if (USE_MOCK_SSO) {
	providers.push(
		GitHub({
			clientId: AUTH_GITHUB_ID,
			clientSecret: AUTH_GITHUB_SECRET
		})
	);
} else {
	providers.push(
		MicrosoftEntraID({
			clientId: AUTH_MICROSOFT_ENTRA_ID_ID,
			clientSecret: AUTH_MICROSOFT_ENTRA_ID_SECRET,
			issuer: AUTH_MICROSOFT_ENTRA_ID_ISSUER
		})
	);
}

export const { handle, signIn, signOut } = SvelteKitAuth({
	providers: providers,

	callbacks: {
		async session({ session }) {
			if (!session.user.email) return session;

			const dbUser = await prisma.user.findUnique({
				where: { email: session.user.email }
			});

			if (dbUser) {
				session.user.id = String(dbUser.id);
				session.user.isSuperAdmin = dbUser.isSuperAdmin;
			}

			return session;
		},
		async signIn({ user }) {
			if (!user.email) return false;

			await prisma.user.upsert({
				where: { email: user.email },
				update: { name: user.name ?? user.email },
				create: {
					email: user.email,
					name: user.name ?? user.email,
					microsoftId: user.id!
				}
			});

			return true;
		}
	},
	pages: {
		signIn: '/login'
	}
});
