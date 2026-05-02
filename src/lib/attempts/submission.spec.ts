import { describe, expect, it } from 'vitest';
import { SubmittedResultValidationError, validateSubmittedVisibleResultShape } from './submission';
import { createDefaultExercise, createIoTestCase, createTestCase } from '$lib/types/exercise';

describe('validateSubmittedVisibleResultShape', () => {
	it('accepts visible-only io results for canonical exercises with hidden tests', () => {
		expect.assertions(2);

		const exercise = createDefaultExercise('io');
		if (exercise.type !== 'io') {
			throw new Error('Expected io exercise');
		}

		const visibleTest = createIoTestCase();
		visibleTest.id = 'visible-double';
		visibleTest.visible = true;
		const hiddenTest = createIoTestCase();
		hiddenTest.id = 'hidden-double';
		hiddenTest.visible = false;

		exercise.io.tests = [visibleTest, hiddenTest];
		exercise.config.io.tests = exercise.io.tests;

		const submitted = validateSubmittedVisibleResultShape(
			exercise,
			JSON.stringify({
				passed: true,
				score: 100,
				totalTests: 1,
				passedTests: 1,
				testResults: [
					{
						id: visibleTest.id,
						description: 'Visible double',
						visible: true,
						passed: true,
						message: 'ok',
						expected: '10',
						actual: '10'
					}
				]
			})
		);

		expect(submitted.totalTests).toBe(1);
		expect(submitted.testResults).toHaveLength(1);
	});

	it('rejects hidden test results from the client payload', () => {
		expect.assertions(1);

		const exercise = createDefaultExercise('turtle');
		if (exercise.type !== 'turtle') {
			throw new Error('Expected turtle exercise');
		}

		const visibleTest = createTestCase('commands');
		visibleTest.id = 'visible-commands';
		visibleTest.visible = true;
		const hiddenTest = createTestCase('commands');
		hiddenTest.id = 'hidden-commands';
		hiddenTest.visible = false;

		exercise.grader.testCases = [visibleTest, hiddenTest];
		exercise.config.grader.testCases = exercise.grader.testCases;

		expect(() =>
			validateSubmittedVisibleResultShape(
				exercise,
				JSON.stringify({
					passed: true,
					score: 100,
					totalTests: 2,
					passedTests: 2,
					testResults: [
						{
							id: visibleTest.id,
							description: 'Visible',
							visible: true,
							passed: true,
							message: 'ok'
						},
						{
							id: hiddenTest.id,
							description: 'Hidden',
							visible: false,
							passed: true,
							message: 'ok'
						}
					]
				})
			)
		).toThrow(SubmittedResultValidationError);
	});
});
