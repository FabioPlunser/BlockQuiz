import type { ROLES } from '$lib/roles';
import type { User as BaseUser } from 'better-auth';

export interface User extends BaseUser {
	role: (typeof ROLES)[number];
}
