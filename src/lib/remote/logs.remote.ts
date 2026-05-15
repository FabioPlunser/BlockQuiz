import { query } from '$app/server';
import { readFile } from 'node:fs/promises';
import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';
import { desc } from 'drizzle-orm';
import { db } from '$db/client';
import { auditLogs } from '$db/schema';
import { auditLogQuerySchema, type AuditLogQueryInput } from '$remote/schemas/logsSchema';
import { requireAuth } from '$lib/utils/requireAuth';
import { Role } from '$lib/roles';

export interface LogEntry {
	timestamp: string;
	level: string;
	message: string;
	__key?: string;
	[key: string]: any;
}

export type LogLevelFilter = 'all' | 'info' | 'warn' | 'error';

export interface AuditLogResponse {
	logs: LogEntry[];
	total: number;
	totalFiltered: number;
	totalPages: number;
	page: number;
	pageSize: number;
}

const fuseOptions: IFuseOptions<LogEntry> = {
	keys: ['message', 'level', 'timestamp', 'service', 'user', 'action', 'actorUserId'],
	threshold: 0.4,
	ignoreLocation: true
};

async function readAppLogEntries(): Promise<LogEntry[]> {
	try {
		const fileContent = await readFile('logs/app.log', 'utf-8');
		if (!fileContent.trim()) return [];

		return fileContent
			.trim()
			.split('\n')
			.map((line) => {
				try {
					return JSON.parse(line) as LogEntry;
				} catch {
					return null;
				}
			})
			.filter((log): log is LogEntry => log !== null);
	} catch {
		return [];
	}
}

async function readDatabaseAuditEntries(): Promise<LogEntry[]> {
	const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.ts));

	return rows.map((row) => {
		let details: unknown = row.detailsJson;
		if (row.detailsJson) {
			try {
				details = JSON.parse(row.detailsJson);
			} catch {
				details = row.detailsJson;
			}
		}

		return {
			id: row.id,
			__key: row.id,
			timestamp: new Date(row.ts).toISOString(),
			level: 'info',
			message: row.action,
			action: row.action,
			actorUserId: row.actorUserId,
			details,
			source: 'audit_logs'
		} satisfies LogEntry;
	});
}

export const getAuditLogs = query(auditLogQuerySchema, async (filters: AuditLogQueryInput) => {
	console.log('getAuditLogs', filters);
	requireAuth(Role.ADMIN);
	try {
		const logs = [...(await readDatabaseAuditEntries()), ...(await readAppLogEntries())]
			.sort((left, right) => {
				return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
			})
			.map((log, index) => {
				const fallbackKeyParts = [
					log.timestamp ?? 'unknown',
					log.service ?? 'service',
					log.message ?? 'message',
					index.toString()
				];
				const fallbackKey = fallbackKeyParts.join('-');
				return {
					...log,
					__key:
						typeof log.__key === 'string'
							? `${log.__key}-${index}`
							: `${log.id ?? log._id ?? fallbackKey}-${index}`
				} satisfies LogEntry;
			});

		const total = logs.length;

		let filtered = logs;

		if (filters.level !== 'all') {
			filtered = filtered.filter((log) => log.level === filters.level);
		}

		const trimmedSearch = filters.search?.trim();
		if (trimmedSearch) {
			const fuse = new Fuse(filtered, fuseOptions);
			filtered = fuse.search(trimmedSearch).map((result) => result.item);
		}

		const totalFiltered = filtered.length;
		const totalPages = Math.max(1, Math.ceil(totalFiltered / filters.pageSize));
		const safePage = Math.min(filters.page, totalPages);
		const start = (safePage - 1) * filters.pageSize;
		const paginated = filtered.slice(start, start + filters.pageSize);

		return {
			logs: paginated,
			total,
			totalFiltered,
			totalPages,
			page: safePage,
			pageSize: filters.pageSize
		};
	} catch (e) {
		// If file doesn't exist or other error, return empty array
		console.error('Error reading logs:', e);
		return {
			logs: [],
			total: 0,
			totalFiltered: 0,
			totalPages: 1,
			page: 1,
			pageSize: filters.pageSize
		};
	}
});
