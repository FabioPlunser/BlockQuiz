import winston from 'winston';
import path from 'path';

// Define log directory
const logDir = 'logs';

export const logger = winston.createLogger({
	level: 'info',
	format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
	defaultMeta: { service: 'blockquiz-app' },
	transports: [
		// Write all logs with importance level of `error` or less to `error.log`
		// Write all logs with importance level of `info` or less to `app.log`
		new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
		new winston.transports.File({ filename: path.join(logDir, 'app.log') })
	]
});

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
	logger.add(
		new winston.transports.Console({
			format: winston.format.simple()
		})
	);
}

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';

export interface LogEntry {
	timestamp: string;
	level: string;
	message: string;
	[key: string]: any;
}

/**
 * Reads and parses the application log file.
 * Only accessible by admins.
 */
export async function getAuditLogs(): Promise<LogEntry[]> {
	// Access the request event via `this` in remote functions
	// @ts-ignore - 'this' is bound to RequestEvent in experimental remote functions
	const user = this.locals.user;

	if (!user || user.role !== 'admin') {
		throw error(403, 'Unauthorized');
	}

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
			.reverse(); // Show newest first

		return logs;
	} catch (e) {
		// If file doesn't exist or other error, return empty array
		console.error('Error reading logs:', e);
		return [];
	}
}
