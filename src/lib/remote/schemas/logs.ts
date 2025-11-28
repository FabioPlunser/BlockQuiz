import { z } from 'zod';

export const auditLogQuerySchema = z.object({
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(200).default(25),
	search: z.string().optional(),
	level: z.enum(['all', 'info', 'warn', 'error']).default('all')
});

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;
