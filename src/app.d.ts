import '@auth/sveltekit';

declare module '@auth/sveltekit' {
	interface Session {
		user: {
			id: string;
			email: string;
			name: string;
			image?: string | null;
			isSuperAdmin: boolean;
		};
	}
}

declare module '@auth/core/types' {
	interface Session {
		user: {
			id: string;
			email: string;
			name: string;
			image?: string | null;
			isSuperAdmin: boolean;
		};
	}

	interface User {
		isSuperAdmin?: boolean;
		image?: string | null;
	}
}

declare global {
	namespace App {
		interface Locals {
			userId?: number;
		}
	}
}

export {};
