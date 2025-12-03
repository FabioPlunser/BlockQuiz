import { z } from 'zod';

// For backward compatibility
export const loginSchema = z.object({
	email: z.email(),
	password: z.string().min(8)
});
