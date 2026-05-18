import { query, command } from '$app/server';
import { readFile } from 'node:fs/promises';
import { and, desc, eq, gte, inArray, like, lte, or, sql, type SQL } from 'drizzle-orm';
import { db } from '$db/client';
import { auditLogs, user as userTable } from '$db/schema';
import {
	auditLogQuerySchema,
	auditLogExportSchema,
	type AuditLogQueryInput,
	type AuditLogExportInput
} from '$remote/schemas/logsSchema';
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
export type LogCategoryFilter = 'all' | 'system' | 'admin' | 'user';

export interface AuditLogResponse {
	logs: LogEntry[];
	total: number;
	totalFiltered: number;
	totalPages: number;
	page: number;
	pageSize: number;
}

export interface AuditUserOption {
	id: string;
	label: string;
}

const SYSTEM_LOG_TAIL_LINES = 2000;

async function readAppLogTail(): Promise<LogEntry[]> {
	try {
		const fileContent = await readFile('logs/app.log', 'utf-8');
		const trimmed = fileContent.trim();
		if (!trimmed) return [];

		const lines = trimmed.split('\n');
		const tail = lines.slice(-SYSTEM_LOG_TAIL_LINES);

		return tail
			.map((line) => {
				try {
					return JSON.parse(line) as LogEntry;
				} catch {
					return null;
				}
			})
			.filter((log): log is LogEntry => log !== null)
			.map((log) => ({ ...log, source: 'app_log', category: 'system' }));
	} catch {
		return [];
	}
}

function buildAuditWhere(filters: {
	category: LogCategoryFilter;
	actorUserId?: string;
	search?: string;
}): SQL | undefined {
	const conditions: SQL[] = [];

	if (filters.category !== 'all' && filters.category !== 'system') {
		conditions.push(eq(auditLogs.category, filters.category));
	}
	if (filters.actorUserId) {
		conditions.push(eq(auditLogs.actorUserId, filters.actorUserId));
	}
	const search = filters.search?.trim();
	if (search) {
		const pattern = `%${search}%`;
		const searchClause = or(
			like(auditLogs.action, pattern),
			like(auditLogs.detailsJson, pattern)
		);
		if (searchClause) conditions.push(searchClause);
	}

	if (conditions.length === 0) return undefined;
	if (conditions.length === 1) return conditions[0];
	return and(...conditions);
}

type AuditJoinedRow = typeof auditLogs.$inferSelect & {
	actorEmail: string | null;
	actorName: string | null;
};

function rowToEntry(row: AuditJoinedRow, index: number): LogEntry {
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
		__key: `${row.id}-${index}`,
		timestamp: new Date(row.ts).toISOString(),
		level: 'info',
		message: row.action,
		action: row.action,
		category: row.category,
		actorUserId: row.actorUserId,
		actorEmail: row.actorEmail,
		actorName: row.actorName,
		details,
		source: 'audit_logs'
	} satisfies LogEntry;
}

export const getAuditLogs = query(auditLogQuerySchema, async (filters: AuditLogQueryInput) => {
	requireAuth(Role.ADMIN);

	const wantsAudit = filters.category !== 'system';
	const wantsSystem = filters.category === 'all' || filters.category === 'system';

	const auditCount = wantsAudit
		? (
				await db
					.select({ value: sql<number>`count(*)` })
					.from(auditLogs)
					.where(buildAuditWhere(filters))
			)[0]?.value ?? 0
		: 0;

	const systemLogs = wantsSystem ? await readAppLogTail() : [];

	const search = filters.search?.trim()?.toLowerCase();
	const filteredSystem = systemLogs.filter((entry) => {
		if (filters.level !== 'all' && entry.level !== filters.level) return false;
		if (filters.actorUserId && entry.actorUserId !== filters.actorUserId) return false;
		if (search) {
			const hay = `${entry.message ?? ''} ${entry.level ?? ''} ${JSON.stringify(entry)}`.toLowerCase();
			if (!hay.includes(search)) return false;
		}
		return true;
	});

	if (filters.level !== 'all' && filters.level !== 'info' && wantsAudit) {
		const totalFiltered = filteredSystem.length;
		const totalPages = Math.max(1, Math.ceil(totalFiltered / filters.pageSize));
		const safePage = Math.min(filters.page, totalPages);
		const start = (safePage - 1) * filters.pageSize;
		return {
			logs: filteredSystem
				.sort(
					(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
				)
				.slice(start, start + filters.pageSize),
			total: filteredSystem.length,
			totalFiltered,
			totalPages,
			page: safePage,
			pageSize: filters.pageSize
		};
	}

	const totalFiltered = auditCount + filteredSystem.length;
	const totalPages = Math.max(1, Math.ceil(totalFiltered / filters.pageSize));
	const safePage = Math.min(filters.page, totalPages);
	const offset = (safePage - 1) * filters.pageSize;

	let auditEntries: LogEntry[] = [];
	if (wantsAudit) {
		const rows = await db
			.select({
				id: auditLogs.id,
				ts: auditLogs.ts,
				actorUserId: auditLogs.actorUserId,
				category: auditLogs.category,
				action: auditLogs.action,
				detailsJson: auditLogs.detailsJson,
				actorEmail: userTable.email,
				actorName: userTable.name
			})
			.from(auditLogs)
			.leftJoin(userTable, eq(userTable.id, auditLogs.actorUserId))
			.where(buildAuditWhere(filters))
			.orderBy(desc(auditLogs.ts))
			.limit(filters.pageSize + filteredSystem.length)
			.offset(offset);
		auditEntries = rows.map((r, i) => rowToEntry(r as AuditJoinedRow, i));
	}

	const merged = [...auditEntries, ...filteredSystem]
		.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
		.slice(0, filters.pageSize);

	return {
		logs: merged,
		total: auditCount + systemLogs.length,
		totalFiltered,
		totalPages,
		page: safePage,
		pageSize: filters.pageSize
	};
});

export const getAuditUsers = query(async () => {
	requireAuth(Role.ADMIN);

	const rows = await db
		.selectDistinct({
			id: auditLogs.actorUserId,
			name: userTable.name,
			email: userTable.email
		})
		.from(auditLogs)
		.leftJoin(userTable, eq(userTable.id, auditLogs.actorUserId))
		.where(sql`${auditLogs.actorUserId} IS NOT NULL`)
		.orderBy(userTable.email);

	return rows
		.filter((r): r is { id: string; name: string | null; email: string | null } => !!r.id)
		.map((r) => ({
			id: r.id,
			label: r.email ? `${r.name ?? r.email} <${r.email}>` : r.id
		})) satisfies AuditUserOption[];
});

function csvEscape(value: unknown): string {
	if (value === null || value === undefined) return '';
	const s = typeof value === 'string' ? value : JSON.stringify(value);
	if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
	return s;
}

function buildExportAuditWhere(filters: AuditLogExportInput): SQL | undefined {
	const conditions: SQL[] = [];
	const dbCategories = filters.categories.filter((c) => c !== 'system');
	if (dbCategories.length > 0 && dbCategories.length < 2) {
		conditions.push(eq(auditLogs.category, dbCategories[0]));
	} else if (dbCategories.length > 0) {
		conditions.push(inArray(auditLogs.category, dbCategories));
	}
	if (filters.actorUserId) {
		conditions.push(eq(auditLogs.actorUserId, filters.actorUserId));
	}
	if (typeof filters.fromTs === 'number') {
		conditions.push(gte(auditLogs.ts, filters.fromTs));
	}
	if (typeof filters.toTs === 'number') {
		conditions.push(lte(auditLogs.ts, filters.toTs));
	}
	const search = filters.search?.trim();
	if (search) {
		const pattern = `%${search}%`;
		const searchClause = or(
			like(auditLogs.action, pattern),
			like(auditLogs.detailsJson, pattern)
		);
		if (searchClause) conditions.push(searchClause);
	}
	if (conditions.length === 0) return undefined;
	if (conditions.length === 1) return conditions[0];
	return and(...conditions);
}

export const exportAuditLogsCsv = command(
	auditLogExportSchema,
	async (filters: AuditLogExportInput) => {
		requireAuth(Role.ADMIN);

		const includesSystem = filters.categories.includes('system');
		const includesDbCategory = filters.categories.some((c) => c !== 'system');

		const auditRows = includesDbCategory
			? await db
					.select({
						id: auditLogs.id,
						ts: auditLogs.ts,
						actorUserId: auditLogs.actorUserId,
						category: auditLogs.category,
						action: auditLogs.action,
						detailsJson: auditLogs.detailsJson,
						actorEmail: userTable.email,
						actorName: userTable.name
					})
					.from(auditLogs)
					.leftJoin(userTable, eq(userTable.id, auditLogs.actorUserId))
					.where(buildExportAuditWhere(filters))
					.orderBy(desc(auditLogs.ts))
					.limit(filters.limit)
			: [];

		const auditEntries = auditRows.map((r, i) => rowToEntry(r as AuditJoinedRow, i));

		let systemEntries: LogEntry[] = [];
		if (includesSystem) {
			const search = filters.search?.trim()?.toLowerCase();
			systemEntries = (await readAppLogTail()).filter((entry) => {
				const ts = new Date(entry.timestamp).getTime();
				if (typeof filters.fromTs === 'number' && ts < filters.fromTs) return false;
				if (typeof filters.toTs === 'number' && ts > filters.toTs) return false;
				if (filters.level !== 'all' && entry.level !== filters.level) return false;
				if (filters.actorUserId && entry.actorUserId !== filters.actorUserId) return false;
				if (search) {
					const hay = `${entry.message ?? ''} ${JSON.stringify(entry)}`.toLowerCase();
					if (!hay.includes(search)) return false;
				}
				return true;
			});
		}

		const all = [...auditEntries, ...systemEntries]
			.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
			.slice(0, filters.limit);

		const columns = filters.columns;
		const lines = [columns.join(',')];
		for (const entry of all) {
			const row = columns.map((col) => {
				switch (col) {
					case 'timestamp':
						return entry.timestamp;
					case 'category':
						return entry.category ?? '';
					case 'level':
						return entry.level ?? '';
					case 'action':
						return entry.action ?? entry.message ?? '';
					case 'actorEmail':
						return entry.actorEmail ?? '';
					case 'actorUserId':
						return entry.actorUserId ?? '';
					case 'message':
						return entry.message ?? '';
					case 'details':
						return entry.details ?? '';
					case 'source':
						return entry.source ?? '';
				}
			});
			lines.push(row.map(csvEscape).join(','));
		}

		return {
			filename: `audit-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`,
			content: lines.join('\n'),
			rowCount: all.length
		};
	}
);
