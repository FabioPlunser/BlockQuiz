import { z } from 'zod';
import { Role, ROLES } from '$lib/roles';

export const userFilterSchema = z.object({
	search: z.string().optional(),
	id: z.string().optional(),
	active: z.boolean().optional(),
	email: z.string().optional(),
	role: z.enum(ROLES as [string, ...string[]]).optional()
});

export const createUpdateUserSchema = z.object({
	id: z.string().optional(),
	email: z.email().optional(),
	active: z.boolean().optional(),
	password: z.string().min(8).optional(),
	role: z.enum(ROLES as [string, ...string[]]).optional()
});
