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
