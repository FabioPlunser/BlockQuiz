import { z } from 'zod';

export const auditLogQuerySchema = z.object({
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(200).default(25),
	search: z.string().optional(),
	level: z.enum(['all', 'info', 'warn', 'error']).default('all'),
	category: z.enum(['all', 'system', 'admin', 'user']).default('all'),
	actorUserId: z.string().optional()
});

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

export const auditLogExportSchema = z.object({
	search: z.string().optional(),
	level: z.enum(['all', 'info', 'warn', 'error']).default('all'),
	categories: z.array(z.enum(['system', 'admin', 'user'])).default(['system', 'admin', 'user']),
	actorUserId: z.string().optional(),
	fromTs: z.number().int().nonnegative().optional(),
	toTs: z.number().int().nonnegative().optional(),
	columns: z
		.array(z.enum(['timestamp', 'category', 'level', 'action', 'actorEmail', 'actorUserId', 'message', 'details', 'source']))
		.default(['timestamp', 'category', 'level', 'action', 'actorEmail', 'message', 'details']),
	limit: z.number().int().min(1).max(100000).default(10000)
});

export type AuditLogExportInput = z.infer<typeof auditLogExportSchema>;
