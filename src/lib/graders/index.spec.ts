import { describe, expect, it } from 'vitest';

import {
	createDefaultExercise,
	type IoExercise,
	type RobotExercise,
	type TurtleExercise
} from '$lib/types/exercise';

import { gradeIoExercise, gradeVisualExercise, normalizeIoText } from './index';

describe('normalizeIoText', () => {
	it('applies configured normalization rules deterministically', () => {
		const normalized = normalizeIoText('  1,5\r\nHELLO\tWORLD  ', {
			trim: true,
			collapseWhitespace: true,
			caseInsensitive: true,
			normalizeLineEndings: true,
			decimalSeparator: 'either'
		});

		expect(normalized).toBe('1.5 hello world');
	});
});

describe('gradeIoExercise', () => {
	it('grades visible and hidden tests with normalization and safe output exposure', () => {
		const exercise = createDefaultExercise('io') as IoExercise;
		exercise.io.normalization = {
			trim: true,
			collapseWhitespace: true,
			caseInsensitive: false,
			normalizeLineEndings: true,
			decimalSeparator: '.'
		};
		exercise.io.tests = [
			{
				id: 'visible',
				description: { de: 'Sichtbar', en: 'Visible' },
				visible: true,
				stdin: '3',
				expectedStdout: '6'
			},
			{
				id: 'hidden',
				description: { de: 'Versteckt', en: 'Hidden' },
				visible: false,
				stdin: '5',
				expectedStdout: '15'
			}
		];

		const result = gradeIoExercise(exercise, [
			{ test: exercise.io.tests[0], execution: { success: true, stdout: ' 6 \n' } },
			{ test: exercise.io.tests[1], execution: { success: true, stdout: '15' } }
		]);

		expect(result.passed).toBe(true);
		expect(result.score).toBe(100);
		expect(result.passedTests).toBe(2);
		expect(result.testResults[0].expected).toBe('6');
		expect(result.testResults[0].actual).toBe(' 6 \n');
		expect(result.testResults[1].expected).toBeUndefined();
		expect(result.testResults[1].actual).toBeUndefined();
	});
});

describe('gradeVisualExercise', () => {
	it('grades turtle path tests against the simulated route', () => {
		const exercise = createDefaultExercise('turtle') as TurtleExercise;
		exercise.canvas = {
			...exercise.canvas,
			width: 400,
			height: 400,
			gridSize: 50
		};
		exercise.grader.appleTolerance = 10;
		exercise.grader.testCases = [
			{
				id: 'path',
				description: { de: 'Pfad', en: 'Path' },
				visible: true,
				type: 'path',
				expected: {
					path: [
						{ x: 200, y: 200 },
						{ x: 200, y: 150 },
						{ x: 250, y: 150 }
					]
				}
			}
		];

		const result = gradeVisualExercise(exercise, {
			success: true,
			commands: [
				{ type: 'move', args: [1], timestamp: 1 },
				{ type: 'turn', args: [90], timestamp: 2 },
				{ type: 'move', args: [1], timestamp: 3 }
			]
		});

		expect(result.passed).toBe(true);
		expect(result.score).toBe(100);
		expect(result.testResults[0].message).toContain('Path');
	});

	it('grades robot state and collectible counts from grid simulation', () => {
		const exercise = createDefaultExercise('robot') as RobotExercise;
		exercise.grid = {
			...exercise.grid,
			start: { x: 0, y: 0 },
			direction: 'east',
			cellSize: 10,
			collectibles: [
				{ x: 10, y: 0 },
				{ x: 20, y: 0 }
			]
		};
		exercise.grader.testCases = [
			{
				id: 'state',
				description: { de: 'Status', en: 'State' },
				visible: true,
				type: 'state',
				expected: {
					state: { x: 20, y: 0, angle: 90, tolerance: 0.001 }
				}
			},
			{
				id: 'collect',
				description: { de: 'Sammeln', en: 'Collect' },
				visible: true,
				type: 'collect',
				expected: {
					collect: { count: 2 }
				}
			}
		];

		const result = gradeVisualExercise(exercise, {
			success: true,
			commands: [
				{ type: 'move', args: [1], timestamp: 1 },
				{ type: 'move', args: [1], timestamp: 2 }
			]
		});

		expect(result.passed).toBe(true);
		expect(result.passedTests).toBe(2);
		expect(result.score).toBe(100);
	});

	it('returns failed test results when execution itself fails', () => {
		const exercise = createDefaultExercise('turtle') as TurtleExercise;
		exercise.grader.testCases = [
			{
				id: 'target',
				description: { de: 'Ziel', en: 'Target' },
				visible: true,
				type: 'target',
				expected: {
					target: { x: 200, y: 150, tolerance: 10 }
				}
			}
		];

		const result = gradeVisualExercise(exercise, {
			success: false,
			commands: [],
			error: 'Execution failed.'
		});

		expect(result.passed).toBe(false);
		expect(result.score).toBe(0);
		expect(result.testResults[0].message).toBe('Execution failed.');
	});
});
