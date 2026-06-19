import '@auth/sveltekit';

declare module '@auth/sveltekit' {
	interface Session {
		user: {
			id: string;
			email: string;
			name: string;
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
			isSuperAdmin: boolean;
		};
	}

	interface User {
		isSuperAdmin?: boolean;
	}
}

export {};
