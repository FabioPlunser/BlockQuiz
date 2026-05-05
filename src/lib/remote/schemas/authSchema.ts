import { z } from 'zod';

// For backward compatibility
export const loginSchema = z.object({
	email: z.email(),
	password: z.string().min(8)
});

export const requestPasswordResetSchema = z.object({
	email: z.email()
});

export const completePasswordResetSchema = z.object({
	token: z.string().min(1),
	password: z.string().min(8)
});
