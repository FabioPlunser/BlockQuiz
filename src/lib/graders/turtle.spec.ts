import { describe, it, expect } from 'vitest';
import { simulateTurtle, gradeTurtle, type TurtleTest, type CanvasConfig } from './turtle';

// Default canvas: 400x400, gridSize 50
// So move:1 = 50 pixels, start position = (200, 200)
const defaultConfig: CanvasConfig = { width: 400, height: 400, gridSize: 50 };

describe('simulateTurtle', () => {
	it('should start at center (200, 200) with angle 0', () => {
		const state = simulateTurtle([], defaultConfig);
		expect(state.x).toBe(200);
		expect(state.y).toBe(200);
		expect(state.angle).toBe(0);
		expect(state.penDown).toBe(true);
	});

	it('should move forward (north) correctly', () => {
		// move:1 = 1 cell = 50 pixels north
		const state = simulateTurtle(['move:1'], defaultConfig);
		// At angle 0, moving forward goes north (y decreases)
		expect(state.x).toBe(200);
		expect(state.y).toBe(150); // 200 - 50 = 150
	});

	it('should turn right and move correctly', () => {
		const state = simulateTurtle(['turn:90', 'move:1'], defaultConfig);
		// After turning 90 degrees right, moving goes east (x increases)
		expect(state.x).toBeCloseTo(250, 5); // 200 + 50 = 250
		expect(state.y).toBeCloseTo(200, 5);
	});

	it('should turn left and move correctly', () => {
		const state = simulateTurtle(['turn:-90', 'move:1'], defaultConfig);
		// After turning 90 degrees left, moving goes west (x decreases)
		expect(state.x).toBeCloseTo(150, 5); // 200 - 50 = 150
		expect(state.y).toBeCloseTo(200, 5);
	});

	it('should handle multiple moves', () => {
		const state = simulateTurtle(['move:1', 'turn:90', 'move:1'], defaultConfig);
		// Move north 50px, turn right, move east 50px
		expect(state.x).toBeCloseTo(250, 5);
		expect(state.y).toBeCloseTo(150, 5);
	});

	it('should track pen state', () => {
		const stateUp = simulateTurtle(['penUp'], defaultConfig);
		expect(stateUp.penDown).toBe(false);

		const stateDown = simulateTurtle(['penUp', 'penDown'], defaultConfig);
		expect(stateDown.penDown).toBe(true);
	});

	it('should handle full rotation', () => {
		const state = simulateTurtle(['turn:360', 'move:1'], defaultConfig);
		expect(state.x).toBeCloseTo(200, 5);
		expect(state.y).toBeCloseTo(150, 5);
		expect(state.angle).toBe(0);
	});

	it('should handle different canvas sizes', () => {
		const smallConfig: CanvasConfig = { width: 200, height: 200, gridSize: 25 };
		const state = simulateTurtle(['move:1'], smallConfig);
		// Start at center (100, 100), move 1 cell = 25 pixels north
		expect(state.x).toBe(100);
		expect(state.y).toBe(75); // 100 - 25 = 75
	});

	it('should handle negative angles correctly', () => {
		const state = simulateTurtle(['turn:-90'], defaultConfig);
		expect(state.angle).toBe(270); // -90 normalized to 270
	});
});

describe('gradeTurtle', () => {
	it('should pass when turtle reaches target within tolerance', () => {
		const tests: TurtleTest[] = [
			{
				id: 'test1',
				description: { de: 'Zum Ziel', en: 'To target' },
				visible: true,
				type: 'target',
				expected: {
					target: { x: 200, y: 150, tolerance: 10 }
				}
			}
		];

		// move:1 = 50 pixels north, ends at (200, 150)
		const result = gradeTurtle(['move:1'], tests, defaultConfig);
		expect(result.passed).toBe(true);
		expect(result.score).toBe(1);
		expect(result.tests[0].passed).toBe(true);
	});

	it('should fail when turtle is outside tolerance', () => {
		const tests: TurtleTest[] = [
			{
				id: 'test1',
				description: { de: 'Zum Ziel', en: 'To target' },
				visible: true,
				type: 'target',
				expected: {
					target: { x: 300, y: 150, tolerance: 10 }
				}
			}
		];

		// move:1 ends at (200, 150), target is at (300, 150) - 100 pixels away
		const result = gradeTurtle(['move:1'], tests, defaultConfig);
		expect(result.passed).toBe(false);
		expect(result.score).toBe(0);
		expect(result.tests[0].passed).toBe(false);
	});

	it('should use default tolerance of 10 when not specified', () => {
		const tests: TurtleTest[] = [
			{
				id: 'test1',
				description: { de: 'Zum Ziel', en: 'To target' },
				visible: true,
				type: 'target',
				expected: {
					target: { x: 200, y: 155 } // 5 pixels away from (200, 150), within default 10
				}
			}
		];

		const result = gradeTurtle(['move:1'], tests, defaultConfig);
		expect(result.passed).toBe(true);
	});

	it('should pass commands test with exact match', () => {
		const tests: TurtleTest[] = [
			{
				id: 'test1',
				description: { de: 'Befehle', en: 'Commands' },
				visible: true,
				type: 'commands',
				expected: {
					commands: ['move:1', 'turn:90']
				}
			}
		];

		const result = gradeTurtle(['move:1', 'turn:90'], tests, defaultConfig);
		expect(result.passed).toBe(true);
		expect(result.score).toBe(1);
	});

	it('should fail commands test with wrong order', () => {
		const tests: TurtleTest[] = [
			{
				id: 'test1',
				description: { de: 'Befehle', en: 'Commands' },
				visible: true,
				type: 'commands',
				expected: {
					commands: ['turn:90', 'move:1']
				}
			}
		];

		const result = gradeTurtle(['move:1', 'turn:90'], tests, defaultConfig);
		expect(result.passed).toBe(false);
	});

	it('should pass state test when position and angle match', () => {
		const tests: TurtleTest[] = [
			{
				id: 'test1',
				description: { de: 'Status', en: 'State' },
				visible: true,
				type: 'state',
				expected: {
					// After turn:90, move:1: position (250, 200), angle 90
					state: { x: 250, y: 200, angle: 90, tolerance: 10 }
				}
			}
		];

		const result = gradeTurtle(['turn:90', 'move:1'], tests, defaultConfig);
		expect(result.passed).toBe(true);
	});

	it('should calculate correct score with multiple tests', () => {
		const tests: TurtleTest[] = [
			{
				id: 'test1',
				description: { de: 'Test 1', en: 'Test 1' },
				visible: true,
				type: 'target',
				expected: { target: { x: 200, y: 150, tolerance: 10 } } // move:1 reaches this
			},
			{
				id: 'test2',
				description: { de: 'Test 2', en: 'Test 2' },
				visible: true,
				type: 'target',
				expected: { target: { x: 300, y: 300, tolerance: 10 } } // move:1 doesn't reach this
			}
		];

		const result = gradeTurtle(['move:1'], tests, defaultConfig);
		expect(result.passed).toBe(false);
		expect(result.score).toBe(0.5);
		expect(result.tests[0].passed).toBe(true);
		expect(result.tests[1].passed).toBe(false);
	});

	it('should return 0 score for empty tests array', () => {
		const result = gradeTurtle(['move:1'], [], defaultConfig);
		expect(result.passed).toBe(true);
		expect(result.score).toBe(0);
		expect(result.tests).toHaveLength(0);
	});

	it('should work with different canvas configurations', () => {
		const smallConfig: CanvasConfig = { width: 200, height: 200, gridSize: 25 };
		const tests: TurtleTest[] = [
			{
				id: 'test1',
				description: { de: 'Zum Ziel', en: 'To target' },
				visible: true,
				type: 'target',
				expected: {
					// Canvas 200x200, center is (100, 100), move:2 = 50px north = (100, 50)
					target: { x: 100, y: 50, tolerance: 10 }
				}
			}
		];

		const result = gradeTurtle(['move:2'], tests, smallConfig);
		expect(result.passed).toBe(true);
	});
});
