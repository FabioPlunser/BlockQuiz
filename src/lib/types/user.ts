import type { User as BaseUser } from 'better-auth';

export interface User extends BaseUser {
	role: string;
}
