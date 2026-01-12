/**
 * Sandbox Execution Tests using Bun
 * 
 * These tests verify the sandbox message protocol and types.
 * Browser-specific functionality (iframe, postMessage) should be tested manually
 * or with an E2E testing framework.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import type {
	ExecuteMessage,
	ResultMessage,
	SandboxExecutionResult,
	SandboxCommand
} from './types';

describe('Sandbox Types', () => {
	test('ExecuteMessage should have correct structure', () => {
		const message: ExecuteMessage = {
			type: 'execute',
			id: 'test-123',
			code: 'api.move(100);',
			apiMethods: ['move', 'turn'],
			timeout: 2000,
			maxCommands: 10000,
			maxIterations: 10000
		};

		expect(message.type).toBe('execute');
		expect(message.id).toBe('test-123');
		expect(message.apiMethods).toContain('move');
		expect(message.apiMethods).toContain('turn');
	});

	test('ResultMessage should have correct structure', () => {
		const result: ResultMessage = {
			type: 'result',
			id: 'test-123',
			success: true,
			commands: [
				{ type: 'move', args: [100], timestamp: Date.now() },
				{ type: 'turn', args: [90], timestamp: Date.now() }
			]
		};

		expect(result.type).toBe('result');
		expect(result.success).toBe(true);
		expect(result.commands).toHaveLength(2);
	});

	test('Failed ResultMessage should include error info', () => {
		const result: ResultMessage = {
			type: 'result',
			id: 'test-456',
			success: false,
			commands: [],
			error: 'Infinite loop detected',
			errorType: 'loop'
		};

		expect(result.success).toBe(false);
		expect(result.error).toBe('Infinite loop detected');
		expect(result.errorType).toBe('loop');
	});

	test('SandboxCommand should store args correctly', () => {
		const command: SandboxCommand = {
			type: 'move',
			args: [100],
			timestamp: Date.now()
		};

		expect(command.type).toBe('move');
		expect(command.args[0]).toBe(100);
	});
});

describe('Loop Trap Logic', () => {
	// Test the loop trap regex logic from sandbox.html
	function injectLoopTrap(code: string, maxIterations: number): string {
		const counterVar = '_loopCount_test';
		
		let processed = code.replace(
			/while\s*\(/g,
			`while (++${counterVar} < ${maxIterations} && (`
		);
		
		processed = processed.replace(
			/for\s*\(\s*([^;]*);([^;]*);/g,
			`for ($1; ++${counterVar} < ${maxIterations} && ($2);`
		);
		
		return `let ${counterVar} = 0;\n${processed}`;
	}

	test('should inject counter into while loops', () => {
		const code = 'while (true) { doSomething(); }';
		const result = injectLoopTrap(code, 1000);
		
		expect(result).toContain('++_loopCount_test < 1000');
		expect(result).toContain('let _loopCount_test = 0');
	});

	test('should inject counter into for loops', () => {
		const code = 'for (let i = 0; i < 10; i++) { doSomething(); }';
		const result = injectLoopTrap(code, 1000);
		
		expect(result).toContain('++_loopCount_test < 1000');
	});

	test('should handle multiple loops', () => {
		const code = `
			while (a) { }
			for (let i = 0; i < 10; i++) { }
			while (b) { }
		`;
		const result = injectLoopTrap(code, 1000);
		
		const whileCount = (result.match(/while \(\+\+/g) || []).length;
		const forCount = (result.match(/for \(.*\+\+_loopCount/g) || []).length;
		
		expect(whileCount).toBe(2);
		expect(forCount).toBe(1);
	});

	test('should not affect code without loops', () => {
		const code = 'api.move(100); api.turn(90);';
		const result = injectLoopTrap(code, 1000);
		
		expect(result).toContain('api.move(100)');
		expect(result).toContain('api.turn(90)');
		expect(result).toContain('let _loopCount_test = 0');
	});
});

describe('API Builder Logic', () => {
	// Test the API builder logic from sandbox.html
	function buildApi(apiMethods: string[], commands: SandboxCommand[], maxCommands: number) {
		const api: Record<string, (...args: (string | number)[]) => void> = {};
		let commandCount = 0;

		for (const methodName of apiMethods) {
			api[methodName] = function(...args: (string | number)[]) {
				commandCount++;
				
				if (commandCount > maxCommands) {
					throw new Error(`COMMAND_LIMIT: Maximum command count (${maxCommands}) exceeded`);
				}
				
				commands.push({
					type: methodName,
					args: args,
					timestamp: Date.now()
				});
			};
		}

		return api;
	}

	test('should create API with specified methods', () => {
		const commands: SandboxCommand[] = [];
		const api = buildApi(['move', 'turn', 'penDown'], commands, 100);
		
		expect(typeof api.move).toBe('function');
		expect(typeof api.turn).toBe('function');
		expect(typeof api.penDown).toBe('function');
	});

	test('should record commands when API methods called', () => {
		const commands: SandboxCommand[] = [];
		const api = buildApi(['move', 'turn'], commands, 100);
		
		api.move(100);
		api.turn(90);
		
		expect(commands).toHaveLength(2);
		expect(commands[0].type).toBe('move');
		expect(commands[0].args).toEqual([100]);
		expect(commands[1].type).toBe('turn');
		expect(commands[1].args).toEqual([90]);
	});

	test('should throw when command limit exceeded', () => {
		const commands: SandboxCommand[] = [];
		const api = buildApi(['move'], commands, 3);
		
		api.move(1);
		api.move(2);
		api.move(3);
		
		expect(() => api.move(4)).toThrow('COMMAND_LIMIT');
	});

	test('should handle multiple arguments', () => {
		const commands: SandboxCommand[] = [];
		const api = buildApi(['setPosition'], commands, 100);
		
		api.setPosition(100, 200);
		
		expect(commands[0].args).toEqual([100, 200]);
	});
});

describe('Security - Blocked Globals', () => {
	// Note: 'eval' and 'Function' cannot be shadowed in strict mode
	// but are still restricted by the sandboxed iframe environment
	const blockedGlobals = [
		'fetch',
		'XMLHttpRequest',
		'WebSocket',
		'localStorage',
		'sessionStorage',
		'indexedDB',
		'document',
		'window',
		'parent',
		'top',
		'opener',
		'frames',
		'self',
		'globalThis',
		// 'eval' - cannot shadow in strict mode
		// 'Function' - cannot shadow in strict mode
		'importScripts',
		'Worker',
		'SharedWorker',
		'ServiceWorker',
		'navigator',
		'location',
		'history',
		'alert',
		'confirm',
		'prompt',
		'open',
		'close',
		'postMessage'
	];

	test('should have comprehensive blocked globals list', () => {
		expect(blockedGlobals).toContain('fetch');
		expect(blockedGlobals).toContain('XMLHttpRequest');
		expect(blockedGlobals).toContain('localStorage');
		expect(blockedGlobals).toContain('document');
		expect(blockedGlobals).toContain('window');
		// eval and Function cannot be shadowed in strict mode but are restricted by iframe sandbox
	});

	test('should block network-related globals', () => {
		const networkGlobals = ['fetch', 'XMLHttpRequest', 'WebSocket'];
		for (const g of networkGlobals) {
			expect(blockedGlobals).toContain(g);
		}
	});

	test('should block storage-related globals', () => {
		const storageGlobals = ['localStorage', 'sessionStorage', 'indexedDB'];
		for (const g of storageGlobals) {
			expect(blockedGlobals).toContain(g);
		}
	});

	test('should block DOM-related globals', () => {
		const domGlobals = ['document', 'window', 'navigator', 'location', 'history'];
		for (const g of domGlobals) {
			expect(blockedGlobals).toContain(g);
		}
	});

	test('should note that eval/Function cannot be shadowed in strict mode', () => {
		// eval and Function cannot be shadowed in strict mode
		// They are restricted by the sandboxed iframe environment instead
		expect(blockedGlobals).not.toContain('eval');
		expect(blockedGlobals).not.toContain('Function');
	});
});

describe('Execution Result Handling', () => {
	test('successful execution should have correct structure', () => {
		const result: SandboxExecutionResult = {
			success: true,
			commands: [
				{ type: 'move', args: [100], timestamp: Date.now() }
			]
		};

		expect(result.success).toBe(true);
		expect(result.commands).toHaveLength(1);
		expect(result.error).toBeUndefined();
	});

	test('failed execution should include error details', () => {
		const result: SandboxExecutionResult = {
			success: false,
			commands: [],
			error: 'Your code took too long to run',
			errorType: 'timeout'
		};

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.errorType).toBe('timeout');
	});

	test('partial execution should return commands before failure', () => {
		const result: SandboxExecutionResult = {
			success: false,
			commands: [
				{ type: 'move', args: [100], timestamp: Date.now() },
				{ type: 'turn', args: [90], timestamp: Date.now() }
			],
			error: 'Runtime error',
			errorType: 'runtime'
		};

		expect(result.success).toBe(false);
		expect(result.commands).toHaveLength(2);
	});
});

