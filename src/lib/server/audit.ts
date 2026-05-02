import { db } from '$db/client';
import { auditLogs } from '$db/schema';
import { logger } from '$lib/logs/logger';

type AuditDetails = Record<string, unknown>;

export async function writeAuditLog(input: {
	actorUserId?: string | null;
	action: string;
	details?: AuditDetails;
}) {
	try {
		await db.insert(auditLogs).values({
			id: crypto.randomUUID(),
			ts: Date.now(),
			actorUserId: input.actorUserId ?? null,
			action: input.action,
			detailsJson: input.details ? JSON.stringify(input.details) : null
		});
	} catch (cause) {
		logger.warn('Failed to write audit log', {
			action: input.action,
			cause: cause instanceof Error ? cause.message : String(cause)
		});
	}
}
