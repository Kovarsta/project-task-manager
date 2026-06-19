import { SvelteKitAuth } from '@auth/sveltekit';
import GitHub from '@auth/sveltekit/providers/github';
import { prisma } from '$lib/prisma';
import {
	AUTH_GITHUB_ID,
	AUTH_GITHUB_SECRET,
} from '$env/static/private';


export const { handle, signIn, signOut } = SvelteKitAuth({
	providers: [
        // Add Microsoft and its Entra ID once we're shipping
        GitHub({
			clientId: AUTH_GITHUB_ID,
			clientSecret: AUTH_GITHUB_SECRET
		})
	],

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
