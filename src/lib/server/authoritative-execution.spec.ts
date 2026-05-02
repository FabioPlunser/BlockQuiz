import { describe, expect, it } from 'vitest';
import { createDefaultExercise, createIoTestCase, createTestCase } from '$lib/types/exercise';
import { gradeExerciseAuthoritatively } from './authoritative-execution';

describe('gradeExerciseAuthoritatively', () => {
	it('grades io exercises by re-executing generated code', async () => {
		const exercise = createDefaultExercise('io');
		if (exercise.type !== 'io') {
			throw new Error('Expected io exercise');
		}
		const visibleTest = createIoTestCase();
		visibleTest.visible = true;
		visibleTest.stdin = '5';
		visibleTest.expectedStdout = '10';

		const hiddenTest = createIoTestCase();
		hiddenTest.visible = false;
		hiddenTest.stdin = '9';
		hiddenTest.expectedStdout = '18';

		exercise.io.tests = [visibleTest, hiddenTest];
		exercise.config.io.tests = exercise.io.tests;

		const result = await gradeExerciseAuthoritatively(
			exercise,
			'const value = Number(readLine());\nprint(value * 2);'
		);

		expect(result.grading.passed).toBe(true);
		expect(result.grading.score).toBe(100);
		expect(result.grading.totalTests).toBe(2);
	});

	it('grades visual exercises from authoritative command execution', async () => {
		const exercise = createDefaultExercise('turtle');
		if (exercise.type !== 'turtle') {
			throw new Error('Expected turtle exercise');
		}
		const commandsTest = createTestCase('commands');
		commandsTest.visible = false;
		commandsTest.expected = {
			commands: ['move:1', 'turn:90']
		};

		exercise.grader.testCases = [commandsTest];
		exercise.config.grader.testCases = exercise.grader.testCases;

		const result = await gradeExerciseAuthoritatively(exercise, 'api.move(1);\napi.turn(90);');

		expect(result.grading.passed).toBe(true);
		expect(result.grading.score).toBe(100);
		expect(result.grading.totalTests).toBe(1);
	});

	it('detects infinite loops via iteration limit', async () => {
		const exercise = createDefaultExercise('io');
		if (exercise.type !== 'io') throw new Error();
		const test = createIoTestCase();
		test.stdin = '';
		test.expectedStdout = 'unreachable';
		exercise.io.tests = [test];
		exercise.config.io.tests = exercise.io.tests;

		const result = await gradeExerciseAuthoritatively(exercise, 'while (true) {}');

		expect(result.grading.passed).toBe(false);
		expect(result.grading.testResults[0].message).toMatch(/loop|iteration/i);
	});

	it('enforces command limit on visual exercises', async () => {
		const exercise = createDefaultExercise('turtle');
		if (exercise.type !== 'turtle') throw new Error();
		const commandsTest = createTestCase('commands');
		commandsTest.expected = { commands: [] };
		exercise.grader.testCases = [commandsTest];
		exercise.config.grader.testCases = exercise.grader.testCases;

		// Exceeds DEFAULT_SANDBOX_MAX_COMMANDS (10 000)
		const code = 'for (let i = 0; i < 20000; i++) { api.move(1); }';
		const result = await gradeExerciseAuthoritatively(exercise, code);

		expect(result.grading.passed).toBe(false);
	});

	it('blocks access to restricted globals', async () => {
		const exercise = createDefaultExercise('io');
		if (exercise.type !== 'io') throw new Error();
		const test = createIoTestCase();
		test.stdin = '';
		test.expectedStdout = 'unreachable';
		exercise.io.tests = [test];
		exercise.config.io.tests = exercise.io.tests;

		const result = await gradeExerciseAuthoritatively(exercise, 'fetch("http://evil.com")');

		expect(result.grading.passed).toBe(false);
	});

	it('handles a worker crash / malformed output gracefully', async () => {
		const exercise = createDefaultExercise('io');
		if (exercise.type !== 'io') throw new Error();
		const test = createIoTestCase();
		test.stdin = '';
		test.expectedStdout = 'hello';
		exercise.io.tests = [test];
		exercise.config.io.tests = exercise.io.tests;

		// process.exit() inside the sandbox won't affect the isolated worker process;
		// but the worker itself catches it because "use strict" + vm context prevents it.
		// A syntax error causes the worker to return success:false gracefully.
		const result = await gradeExerciseAuthoritatively(exercise, ';;;unexpected syntax error***');

		expect(result.grading.passed).toBe(false);
	});

	it('returns score 0 when io output does not match', async () => {
		const exercise = createDefaultExercise('io');
		if (exercise.type !== 'io') throw new Error();
		const test = createIoTestCase();
		test.stdin = '3';
		test.expectedStdout = '99';
		exercise.io.tests = [test];
		exercise.config.io.tests = exercise.io.tests;

		const result = await gradeExerciseAuthoritatively(exercise, 'print(readLine());');

		expect(result.grading.passed).toBe(false);
		expect(result.grading.score).toBe(0);
	});

	it('throws for empty generated code', async () => {
		const exercise = createDefaultExercise('io');
		await expect(gradeExerciseAuthoritatively(exercise, '   ')).rejects.toThrow(
			'No generated code provided'
		);
	});
});
