import { Script, createContext } from 'node:vm';

const DEFAULT_SANDBOX_TIMEOUT = 2000;
const DEFAULT_SANDBOX_MAX_COMMANDS = 10000;
const DEFAULT_SANDBOX_MAX_ITERATIONS = 10000;

const BLOCKED_GLOBAL_NAMES = [
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
];

function instrumentLoops(code, tickFunctionName) {
	const withWhileTrap = code.replace(/\bwhile\s*\(/g, `while (${tickFunctionName}(), `);
	const withForTrap = withWhileTrap.replace(
		/\bfor\s*\(\s*([^;]*);([^;]*);/g,
		(_match, initializer, condition) => {
			const normalizedCondition = condition.trim().length > 0 ? `(${condition})` : 'true';
			return `for (${initializer}; ${tickFunctionName}(), ${normalizedCondition};`;
		}
	);
	return withForTrap.replace(/\bdo\s*\{/g, `do { ${tickFunctionName}();`);
}

function normalizeSandboxError(error) {
	const fallback = 'Execution failed.';
	const message =
		error instanceof Error ? error.message : typeof error === 'string' ? error : fallback;

	if (message.includes('TIMEOUT')) {
		return { error: 'Execution exceeded the configured time limit.', errorType: 'timeout' };
	}
	if (message.includes('LOOP_LIMIT')) {
		return { error: 'Execution exceeded the configured iteration limit.', errorType: 'loop' };
	}
	if (message.includes('COMMAND_LIMIT')) {
		return {
			error: 'Execution exceeded the configured command limit.',
			errorType: 'command_limit'
		};
	}
	if (message.includes('SecurityError') || message.includes('Blocked access')) {
		return { error: 'Blocked access to a restricted browser API.', errorType: 'security' };
	}
	return { error: message || fallback, errorType: 'runtime' };
}

function formatValue(value) {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	if (value == null) return '';
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function createCommandApi(maxCmds) {
	const commands = [];
	let count = 0;

	function record(type, ...args) {
		count++;
		if (count > maxCmds) {
			throw new Error(`COMMAND_LIMIT: Maximum command count (${maxCmds}) exceeded`);
		}
		commands.push({ type, args: args.map((a) => String(a)), timestamp: Date.now() });
	}

	const api = {
		move: (d) => record('move', d),
		turn: (deg) => record('turn', deg),
		step: () => record('move', 1),
		turn_left: () => record('turn', -90),
		turn_right: () => record('turn', 90),
		penUp: () => record('pen', 'up'),
		penDown: () => record('pen', 'down'),
		setPen: (state) => record('pen', state),
		color: (c) => record('color', c),
		collect: () => record('collect'),
		reset: () => {
			commands.length = 0;
			count = 0;
		}
	};

	return { api, commands };
}

function createIoRuntime(stdinStr) {
	const lines = String(stdinStr).split(/\r?\n/);
	let cursor = 0;
	const prints = [];
	let stderr = '';

	function print(value) {
		prints.push(formatValue(value));
	}

	function logError(args) {
		const next = args.map(formatValue).join(' ');
		stderr = stderr ? `${stderr}\n${next}` : next;
	}

	function prompt() {
		const line = cursor < lines.length ? lines[cursor] : '';
		cursor++;
		return line;
	}

	const safeConsole = {
		log: (...args) => print(args.map(formatValue).join(' ')),
		warn: (...args) => logError(args),
		error: (...args) => logError(args)
	};

	const safeWindow = {
		alert: print,
		prompt,
		console: safeConsole
	};

	return {
		print,
		prompt,
		readLine: prompt,
		input: String(stdinStr),
		console: safeConsole,
		window: safeWindow,
		self: safeWindow,
		globalThis: safeWindow,
		get stdout() {
			return prints.join('\n');
		},
		get stderr() {
			return stderr;
		}
	};
}

const MAX_OUTPUT_BYTES = 1024 * 1024;

const chunks = [];
for await (const chunk of process.stdin) {
	chunks.push(chunk);
}
const inputJson = Buffer.concat(chunks).toString('utf8');

function fail(message, errorType = 'runtime') {
	process.stdout.write(JSON.stringify({ success: false, commands: [], error: message, errorType }));
	process.exit(1);
}

let input;
try {
	input = JSON.parse(inputJson);
} catch {
	fail('Invalid worker input: could not parse JSON.');
}

const {
	exerciseType,
	code,
	stdin = '',
	seed,
	maxCommands = DEFAULT_SANDBOX_MAX_COMMANDS,
	maxIterations = DEFAULT_SANDBOX_MAX_ITERATIONS,
	timeout = DEFAULT_SANDBOX_TIMEOUT
} = input;

if (!code || typeof code !== 'string') {
	fail('Invalid worker input: missing code.');
}
if (!exerciseType || typeof exerciseType !== 'string') {
	fail('Invalid worker input: missing exerciseType.');
}

const isVisual = exerciseType === 'turtle' || exerciseType === 'robot';
const { api: commandApi, commands } = createCommandApi(maxCommands);
const ioRuntime = createIoRuntime(stdin);

let iterations = 0;
const tickName = `__workerTick_${Math.random().toString(36).slice(2, 10)}`;
const protectedCode = instrumentLoops(code.trim(), tickName);

function tick() {
	iterations++;
	if (iterations > maxIterations) {
		throw new Error(`LOOP_LIMIT: Maximum iteration count (${maxIterations}) exceeded`);
	}
	return true;
}

const blockedGlobals = Object.fromEntries(
	BLOCKED_GLOBAL_NAMES.map((name) => [
		name,
		() => {
			throw new Error(`Blocked access to ${name}`);
		}
	])
);

const context = createContext({
	api: isVisual ? commandApi : {},
	print: ioRuntime.print,
	prompt: ioRuntime.prompt,
	readLine: ioRuntime.readLine,
	input: ioRuntime.input,
	console: ioRuntime.console,
	window: ioRuntime.window,
	self: ioRuntime.self,
	globalThis: ioRuntime.globalThis,
	__seed: seed,
	[tickName]: tick,
	...blockedGlobals
});

let result;
try {
	const script = new Script(`"use strict";\n${protectedCode}`);
	script.runInContext(context, { timeout });
	result = {
		success: true,
		commands: isVisual ? commands : [],
		stdout: ioRuntime.stdout || undefined,
		stderr: ioRuntime.stderr || undefined
	};
} catch (err) {
	const normalized = normalizeSandboxError(err);
	result = {
		success: false,
		commands: isVisual ? commands : [],
		stdout: ioRuntime.stdout || undefined,
		stderr: ioRuntime.stderr || undefined,
		error: normalized.error,
		errorType: normalized.errorType
	};
}

const resultJson = JSON.stringify(result);
if (resultJson.length > MAX_OUTPUT_BYTES) {
	process.stdout.write(
		JSON.stringify({
			success: false,
			commands: [],
			error: 'Worker output exceeded size limit.',
			errorType: 'runtime'
		})
	);
} else {
	process.stdout.write(resultJson);
}
