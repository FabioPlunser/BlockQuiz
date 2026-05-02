import type { SandboxErrorType } from './types';

export const DEFAULT_SANDBOX_TIMEOUT = 2000;
export const DEFAULT_SANDBOX_MAX_COMMANDS = 10000;
export const DEFAULT_SANDBOX_MAX_ITERATIONS = 10000;

export const BLOCKED_GLOBALS = [
	'fetch',
	'XMLHttpRequest',
	'WebSocket',
	'localStorage',
	'sessionStorage',
	'indexedDB',
	'document',
	'parent',
	'top',
	'opener',
	'frames',
	'importScripts',
	'Worker',
	'SharedWorker',
	'ServiceWorker',
	'navigator',
	'location',
	'history',
	'open',
	'close',
	'postMessage'
] as const;

export function createSandboxChannelId(): string {
	return `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function instrumentLoops(code: string, tickFunctionName: string): string {
	const withWhileTrap = code.replace(/\bwhile\s*\(/g, `while (${tickFunctionName}(), `);

	const withForTrap = withWhileTrap.replace(
		/\bfor\s*\(\s*([^;]*);([^;]*);/g,
		(_match, initializer: string, condition: string) => {
			const normalizedCondition = condition.trim().length > 0 ? `(${condition})` : 'true';
			return `for (${initializer}; ${tickFunctionName}(), ${normalizedCondition};`;
		}
	);

	return withForTrap.replace(/\bdo\s*\{/g, `do { ${tickFunctionName}();`);
}

export function normalizeSandboxError(error: unknown): {
	error: string;
	errorType: SandboxErrorType;
} {
	const fallback = 'Execution failed.';
	const message =
		error instanceof Error ? error.message : typeof error === 'string' ? error : fallback;

	if (message.includes('TIMEOUT')) {
		return {
			error: 'Execution exceeded the configured time limit.',
			errorType: 'timeout'
		};
	}

	if (message.includes('LOOP_LIMIT')) {
		return {
			error: 'Execution exceeded the configured iteration limit.',
			errorType: 'loop'
		};
	}

	if (message.includes('COMMAND_LIMIT')) {
		return {
			error: 'Execution exceeded the configured command limit.',
			errorType: 'command_limit'
		};
	}

	if (message.includes('SecurityError') || message.includes('Blocked access')) {
		return {
			error: 'Blocked access to a restricted browser API.',
			errorType: 'security'
		};
	}

	return {
		error: message || fallback,
		errorType: 'runtime'
	};
}

export function toUserFacingExecutionError(
	errorType: SandboxErrorType | undefined,
	fallback?: string
): string {
	switch (errorType) {
		case 'timeout':
			return 'Your code took too long to run. Check for infinite loops or very large computations.';
		case 'loop':
			return 'Infinite loop detected. Your code ran too many iterations.';
		case 'command_limit':
			return 'Too many commands were executed. Try solving the task with fewer repeated actions.';
		case 'security':
			return 'Your code tried to use a blocked browser API.';
		default:
			return fallback || 'Execution failed.';
	}
}
