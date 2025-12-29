import { query } from '$app/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';
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
	keys: ['message', 'level', 'timestamp', 'service', 'user'],
	threshold: 0.4,
	ignoreLocation: true
};

export const getAuditLogs = query(auditLogQuerySchema, async (filters: AuditLogQueryInput) => {
	requireAuth(Role.ADMIN);
	try {
		const logPath = path.join(process.cwd(), 'logs', 'app.log');

		// Check if file exists (readFile throws if not)
		const fileContent = await readFile(logPath, 'utf-8');

		// Parse JSON lines
		const logs = fileContent
			.trim()
			.split('\n')
			.map((line) => {
				try {
					return JSON.parse(line);
				} catch (e) {
					return null;
				}
			})
			.filter((l): l is LogEntry => l !== null)
			.reverse() // Show newest first
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
