import { z } from 'zod';
import { ROLES } from '$lib/roles';

export const userFilterSchema = z.object({
	search: z.string().optional(),
	id: z.string().optional(),
	active: z.boolean().optional(),
	email: z.string().optional(),
	role: z.enum(ROLES).optional()
});

export const createUserSchema = z.object({
	email: z.email(),
	password: z.string().min(8),
	active: z.boolean().optional(),
	role: z.enum(ROLES).optional()
});

export const updateUserSchema = z.object({
	id: z.string(),
	email: z.email(),
	active: z.boolean().optional(),
	role: z.enum(ROLES).optional()
});

export const resetPasswordSchema = z.object({
	email: z.email(),
	password: z.string().min(8)
});
