import type { Session, User as BaseUser } from 'better-auth';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	declare namespace App {
		interface Locals {
			session?: Session;
			user?: User;
		}
		interface User extends BaseUser {
			role: string;
		}
		interface PageState {
			courseId: string | null;
			exerciseId: string | null;
		}
	}
}
export {};
