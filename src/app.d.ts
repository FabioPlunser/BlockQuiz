// See https://svelte.dev/docs/kit/types#app.d.ts

import type { User as LuciaUser, Session } from "lucia";

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}

		interface Locals {
			user: LuciaUser | null;
			session: Session | null;
			locale: 'de' | 'en';
		}
	}
}

export { };
