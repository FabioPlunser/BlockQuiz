// See https://svelte.dev/docs/kit/types#app.d.ts

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: {
				id: string;
				userId: string;
				expiresAt: Date;
			} | null;
			user: {
				id: string;
				email: string;
				username?: string;
				role: 'student' | 'teacher' | 'author' | 'admin';
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export { };
