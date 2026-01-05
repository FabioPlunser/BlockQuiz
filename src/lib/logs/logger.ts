import winston from 'winston';
import path from 'path';

// Define log directory
const logDir = 'logs';

const baseLogger = winston.createLogger({
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
	baseLogger.add(
		new winston.transports.Console({
			format: winston.format.simple()
		})
	);
}

/**
 * Extracts the calling function name from the stack trace
 */
function getCallerFunctionName(): string | undefined {
	const stack = new Error().stack;
	if (!stack) return undefined;

	// Split stack into lines and skip the first 3 lines:
	// 1. Error
	// 2. getCallerFunctionName
	// 3. The logger wrapper method (error/info/etc.)
	// 4. The actual calling function (what we want)
	const stackLines = stack.split('\n');

	// Try to find the calling function name
	// Stack trace format: "    at FunctionName (file:line:column)" or "    at file:line:column"
	for (let i = 3; i < stackLines.length; i++) {
		const line = stackLines[i];
		if (!line) continue;

		// Match patterns like:
		// "    at resetPassword (file:line:column)"
		// "    at async resetPassword (file:line:column)"
		// "    at Object.resetPassword (file:line:column)"
		const match = line.match(/at\s+(?:async\s+)?(?:Object\.)?(\w+)\s*\(/);
		if (match && match[1]) {
			// Skip internal logger/wrapper function names
			const funcName = match[1];
			if (funcName !== 'getCallerFunctionName' &&
				funcName !== 'error' &&
				funcName !== 'info' &&
				funcName !== 'warn' &&
				funcName !== 'debug') {
				return funcName;
			}
		}
	}

	return undefined;
}

/**
 * Creates a wrapper function that automatically adds the calling function name
 */
function createLogWrapper(originalMethod: winston.LeveledLogMethod) {
	return function (message: string, meta?: any) {
		const functionName = getCallerFunctionName();
		const enhancedMeta = {
			...(typeof meta === 'object' && meta !== null ? meta : {}),
			...(functionName ? { function: functionName } : {})
		};

		// If meta was a plain object, use enhancedMeta, otherwise pass original meta
		if (typeof meta === 'object' && meta !== null) {
			originalMethod(message, enhancedMeta);
		} else {
			originalMethod(message, enhancedMeta);
		}
	};
}

// Export a logger with wrapped methods that automatically capture function names
export const logger = {
	error: createLogWrapper(baseLogger.error.bind(baseLogger)),
	info: createLogWrapper(baseLogger.info.bind(baseLogger)),
	warn: createLogWrapper(baseLogger.warn.bind(baseLogger)),
	debug: createLogWrapper(baseLogger.debug.bind(baseLogger)),
	// Keep other methods as-is
	log: baseLogger.log.bind(baseLogger),
	verbose: baseLogger.verbose.bind(baseLogger),
	silly: baseLogger.silly.bind(baseLogger)
};
// ... existing code ...
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
