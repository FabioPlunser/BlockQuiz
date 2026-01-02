import { describe, it, expect } from 'vitest';
import { simulateTurtle, gradeTurtle, type TurtleTest } from './turtle';

describe('simulateTurtle', () => {
  it('should start at center (200, 200) with angle 0', () => {
    const state = simulateTurtle([]);
    expect(state.x).toBe(200);
    expect(state.y).toBe(200);
    expect(state.angle).toBe(0);
    expect(state.penDown).toBe(true);
  });

  it('should move forward (north) correctly', () => {
    const state = simulateTurtle(['move:50']);
    // At angle 0, moving forward goes north (y decreases)
    expect(state.x).toBe(200);
    expect(state.y).toBe(150);
  });

  it('should turn right and move correctly', () => {
    const state = simulateTurtle(['turn:90', 'move:50']);
    // After turning 90 degrees right, moving goes east (x increases)
    expect(state.x).toBeCloseTo(250, 5);
    expect(state.y).toBeCloseTo(200, 5);
  });

  it('should turn left and move correctly', () => {
    const state = simulateTurtle(['turn:-90', 'move:50']);
    // After turning 90 degrees left, moving goes west (x decreases)
    expect(state.x).toBeCloseTo(150, 5);
    expect(state.y).toBeCloseTo(200, 5);
  });

  it('should handle multiple moves', () => {
    const state = simulateTurtle(['move:50', 'turn:90', 'move:50']);
    // Move north 50, turn right, move east 50
    expect(state.x).toBeCloseTo(250, 5);
    expect(state.y).toBeCloseTo(150, 5);
  });

  it('should track pen state', () => {
    const stateUp = simulateTurtle(['penUp']);
    expect(stateUp.penDown).toBe(false);

    const stateDown = simulateTurtle(['penUp', 'penDown']);
    expect(stateDown.penDown).toBe(true);
  });

  it('should handle full rotation', () => {
    const state = simulateTurtle(['turn:360', 'move:50']);
    expect(state.x).toBeCloseTo(200, 5);
    expect(state.y).toBeCloseTo(150, 5);
    expect(state.angle).toBe(0);
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

    const result = gradeTurtle(['move:50'], tests);
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

    const result = gradeTurtle(['move:50'], tests);
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
          target: { x: 200, y: 155 } // 5 pixels away, within default 10
        }
      }
    ];

    const result = gradeTurtle(['move:50'], tests);
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
          commands: ['move:50', 'turn:90']
        }
      }
    ];

    const result = gradeTurtle(['move:50', 'turn:90'], tests);
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
          commands: ['turn:90', 'move:50']
        }
      }
    ];

    const result = gradeTurtle(['move:50', 'turn:90'], tests);
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
          state: { x: 250, y: 200, angle: 90, tolerance: 10 }
        }
      }
    ];

    const result = gradeTurtle(['turn:90', 'move:50'], tests);
    expect(result.passed).toBe(true);
  });

  it('should calculate correct score with multiple tests', () => {
    const tests: TurtleTest[] = [
      {
        id: 'test1',
        description: { de: 'Test 1', en: 'Test 1' },
        visible: true,
        type: 'target',
        expected: { target: { x: 200, y: 150, tolerance: 10 } }
      },
      {
        id: 'test2',
        description: { de: 'Test 2', en: 'Test 2' },
        visible: true,
        type: 'target',
        expected: { target: { x: 300, y: 300, tolerance: 10 } }
      }
    ];

    const result = gradeTurtle(['move:50'], tests);
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0.5);
    expect(result.tests[0].passed).toBe(true);
    expect(result.tests[1].passed).toBe(false);
  });

  it('should return 0 score for empty tests array', () => {
    const result = gradeTurtle(['move:50'], []);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(0);
    expect(result.tests).toHaveLength(0);
  });
});

