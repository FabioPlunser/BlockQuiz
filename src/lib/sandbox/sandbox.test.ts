import { describe, expect, test } from 'vitest';
import {
	BLOCKED_GLOBALS,
	createSandboxChannelId,
	instrumentLoops,
	normalizeSandboxError,
	toUserFacingExecutionError
} from './runtime';
import type {
	ExecuteMessage,
	ExecutionTrace,
	ResultMessage,
	SandboxCommand,
	SandboxExecutionResult
} from './types';

describe('Sandbox Protocol', () => {
	test('execute message carries channel, exercise type, and limits', () => {
		const message: ExecuteMessage = {
			type: 'execute',
			channelId: 'sandbox-channel',
			id: 'request-1',
			code: 'api.move(1);',
			exerciseType: 'turtle',
			apiMethods: ['move', 'turn'],
			timeout: 1500,
			maxCommands: 100,
			maxIterations: 200
		};

		expect(message.channelId).toBe('sandbox-channel');
		expect(message.exerciseType).toBe('turtle');
		expect(message.apiMethods).toEqual(['move', 'turn']);
	});

	test('result message returns an execution trace', () => {
		const trace: ExecutionTrace = {
			durationMs: 12,
			commands: [{ type: 'move', args: [1], timestamp: Date.now() }],
			finalState: { x: 200, y: 150, angle: 90 }
		};

		const message: ResultMessage = {
			type: 'result',
			channelId: 'sandbox-channel',
			id: 'request-1',
			success: true,
			trace
		};

		expect(message.trace.durationMs).toBe(12);
		expect(message.trace.commands).toHaveLength(1);
		expect(message.trace.finalState?.angle).toBe(90);
	});
});

describe('Loop Instrumentation', () => {
	test('injects a tick call into while loops', () => {
		const output = instrumentLoops('while (true) { api.move(1); }', '__tick');
		expect(output).toContain('while (__tick(), true)');
	});

	test('injects a tick call into for loops', () => {
		const output = instrumentLoops('for (let i = 0; i < 10; i++) { api.move(i); }', '__tick');
		expect(output).toContain('for (let i = 0; __tick(), ( i < 10);');
	});

	test('treats empty for-loop conditions as true', () => {
		const output = instrumentLoops('for (;;) { api.turn(90); }', '__tick');
		expect(output).toContain('for (; __tick(), true;');
	});

	test('injects a tick call into do-while loops', () => {
		const output = instrumentLoops('do { api.move(1); } while (x < 3);', '__tick');
		expect(output).toContain('do { __tick();');
	});
});

describe('Blocked Globals', () => {
	test('keeps dangerous browser APIs blocked', () => {
		expect(BLOCKED_GLOBALS).toContain('fetch');
		expect(BLOCKED_GLOBALS).toContain('XMLHttpRequest');
		expect(BLOCKED_GLOBALS).toContain('localStorage');
		expect(BLOCKED_GLOBALS).toContain('document');
		expect(BLOCKED_GLOBALS).toContain('postMessage');
	});

	test('does not block safe io shims like window or prompt', () => {
		expect(BLOCKED_GLOBALS).not.toContain('window');
		expect(BLOCKED_GLOBALS).not.toContain('prompt');
		expect(BLOCKED_GLOBALS).not.toContain('alert');
	});
});

describe('Error Normalization', () => {
	test('maps timeout sentinel errors', () => {
		expect(normalizeSandboxError(new Error('TIMEOUT: too slow'))).toEqual({
			error: 'Execution exceeded the configured time limit.',
			errorType: 'timeout'
		});
	});

	test('maps command limit sentinel errors', () => {
		expect(normalizeSandboxError(new Error('COMMAND_LIMIT: too many commands'))).toEqual({
			error: 'Execution exceeded the configured command limit.',
			errorType: 'command_limit'
		});
	});

	test('maps security errors', () => {
		expect(normalizeSandboxError(new Error('Blocked access to fetch'))).toEqual({
			error: 'Blocked access to a restricted browser API.',
			errorType: 'security'
		});
	});

	test('returns user-facing execution messages', () => {
		expect(toUserFacingExecutionError('loop')).toContain('Infinite loop');
		expect(toUserFacingExecutionError('security')).toContain('blocked browser API');
	});
});

describe('Execution Shapes', () => {
	test('sandbox commands can hold mixed argument types', () => {
		const command: SandboxCommand = {
			type: 'setPen',
			args: ['down', 1],
			timestamp: Date.now()
		};

		expect(command.args).toEqual(['down', 1]);
	});

	test('execution results include traces for io', () => {
		const result: SandboxExecutionResult = {
			success: true,
			trace: {
				durationMs: 4,
				stdout: '6',
				stderr: '',
				prints: ['6'],
				commands: []
			}
		};

		expect(result.trace.stdout).toBe('6');
		expect(result.trace.prints).toEqual(['6']);
	});

	test('channel ids are non-empty and unique enough for runtime use', () => {
		const first = createSandboxChannelId();
		const second = createSandboxChannelId();

		expect(first).not.toBe(second);
		expect(first.startsWith('sandbox-')).toBe(true);
		expect(second.startsWith('sandbox-')).toBe(true);
	});
});
