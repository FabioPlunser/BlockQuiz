import { appendFile, mkdir } from 'node:fs/promises';

type LogLevel = 'error' | 'info' | 'warn' | 'debug';
type LogMeta = Record<string, unknown>;

const LOG_DIR = 'logs';
const APP_LOG_PATH = `${LOG_DIR}/app.log`;
const ERROR_LOG_PATH = `${LOG_DIR}/error.log`;
const SERVICE = 'blockquiz-app';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

let ensureLogDirPromise: Promise<void> | null = null;

function ensureLogDirectory() {
	if (!ensureLogDirPromise) {
		ensureLogDirPromise = mkdir(LOG_DIR, { recursive: true }).then(() => undefined);
	}

	return ensureLogDirPromise;
}

function getCallerFunctionName(): string | undefined {
	const stack = new Error().stack;
	if (!stack) return undefined;

	const stackLines = stack.split('\n');

	for (let i = 3; i < stackLines.length; i++) {
		const line = stackLines[i];
		if (!line) continue;

		const match = line.match(/at\s+(?:async\s+)?(?:Object\.)?(\w+)\s*\(/);
		if (match && match[1]) {
			const funcName = match[1];
			if (
				funcName !== 'getCallerFunctionName' &&
				funcName !== 'writeLog' &&
				funcName !== 'error' &&
				funcName !== 'info' &&
				funcName !== 'warn' &&
				funcName !== 'debug'
			) {
				return funcName;
			}
		}
	}
}

function getConsoleMethod(level: LogLevel) {
	if (level === 'error') return console.error;
	if (level === 'warn') return console.warn;
	return console.log;
}

function serializeEntry(level: LogLevel, message: string, meta?: LogMeta) {
	const functionName = getCallerFunctionName();
	const entry = {
		timestamp: new Date().toISOString(),
		level,
		message,
		service: SERVICE,
		...(functionName ? { function: functionName } : {}),
		...(meta ?? {})
	};

	return `${JSON.stringify(entry)}\n`;
}

function writeLog(level: LogLevel, message: string, meta?: LogMeta) {
	const line = serializeEntry(level, message, meta);

	void ensureLogDirectory()
		.then(async () => {
			await appendFile(APP_LOG_PATH, line);
			if (level === 'error') {
				await appendFile(ERROR_LOG_PATH, line);
			}
		})
		.catch((error) => {
			console.error('Failed to write log entry', error);
		});

	if (!IS_PRODUCTION) {
		getConsoleMethod(level)(`${level}: ${message}`, meta ?? {});
	}
}

export const logger = {
	error(message: string, meta?: LogMeta) {
		writeLog('error', message, meta);
	},
	info(message: string, meta?: LogMeta) {
		writeLog('info', message, meta);
	},
	warn(message: string, meta?: LogMeta) {
		writeLog('warn', message, meta);
	},
	debug(message: string, meta?: LogMeta) {
		writeLog('debug', message, meta);
	},
	log(message: string, meta?: LogMeta) {
		writeLog('info', message, meta);
	},
	verbose(message: string, meta?: LogMeta) {
		writeLog('debug', message, meta);
	},
	silly(message: string, meta?: LogMeta) {
		writeLog('debug', message, meta);
	}
};
