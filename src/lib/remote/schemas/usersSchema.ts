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
	id: z.string(),
	email: z.email(),
	password: z.string().optional(),
	active: z.boolean().optional(),
	role: z.enum(ROLES as [string, ...string[]]).optional()
});

export const resetPasswordSchema = z.object({
	email: z.email(),
	password: z.string().min(8)
});
