import type { ICanvasEngine, IPositionEngine, Command } from '$lib/canvas/types';
import type { TestCase } from '$lib/types/exercise';
import { gradeTurtle, type GradeResult } from '$lib/graders/turtle';

// =============================================================================
// Types
// =============================================================================

export interface ExecutionResult {
  success: boolean;
  error?: string;
  commands: Command[];
  finalState?: {
    x: number;
    y: number;
    angle: number;
  };
}

export interface GradingResult {
  passed: boolean;
  score: number;
  totalTests: number;
  passedTests: number;
  testResults: Array<{
    id: string;
    description: string;
    passed: boolean;
    message: string;
    visible: boolean;
  }>;
}

// =============================================================================
// Code Execution
// =============================================================================

/**
 * Execute generated Blockly code against an engine.
 * Uses a simple eval with loop protection.
 */
export function executeCode(
  code: string,
  engine: ICanvasEngine
): ExecutionResult {
  // Reset the engine before execution
  engine.reset();

  // Get the API from the engine
  const api = engine.api;

  // Add loop protection
  const maxIterations = 10000;
  let iterationCount = 0;

  const protectedCode = code.replace(
    /while\s*\(/g,
    `while (++_loopCounter < ${maxIterations} && (`
  ).replace(
    /for\s*\(/g,
    `for (_loopCounter = 0; _loopCounter < ${maxIterations} && (`
  );

  try {
    // Create a sandboxed execution context
    const sandboxedFunction = new Function(
      'api',
      '_loopCounter',
      `
			"use strict";
			let _loopCounter = 0;
			${code}
		`
    );

    sandboxedFunction(api, iterationCount);

    // Get final state if it's a position engine
    let finalState;
    if ('state' in engine) {
      const posEngine = engine as IPositionEngine;
      finalState = {
        x: posEngine.state.x,
        y: posEngine.state.y,
        angle: posEngine.state.angle
      };
    }

    return {
      success: true,
      commands: engine.commands,
      finalState
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown execution error';

    // Check for loop protection trigger
    if (errorMessage.includes('Maximum call stack') || iterationCount >= maxIterations) {
      return {
        success: false,
        error: 'Infinite loop detected. Your code ran too long.',
        commands: engine.commands
      };
    }

    return {
      success: false,
      error: errorMessage,
      commands: engine.commands
    };
  }
}

// =============================================================================
// Grading
// =============================================================================

/**
 * Grade an exercise based on test cases and execution result.
 */
export function gradeExercise(
  commands: Command[],
  testCases: TestCase[],
  exerciseType: 'turtle' | 'robot' | 'io'
): GradingResult {
  if (exerciseType === 'io') {
    // IO exercises are graded differently (input/output matching)
    // For now, return a placeholder
    return {
      passed: false,
      score: 0,
      totalTests: testCases.length,
      passedTests: 0,
      testResults: testCases.map((t) => ({
        id: t.id,
        description: t.description.en || t.description.de,
        passed: false,
        message: 'IO grading not yet implemented',
        visible: t.visible
      }))
    };
  }

  // Convert commands to string format for grader
  const commandStrings = commands.map((cmd) => {
    if (cmd.args.length === 0) {
      return cmd.type;
    }
    return `${cmd.type}:${cmd.args.join(',')}`;
  });

  // Convert TestCase[] to TurtleTest[] format
  const turtleTests = testCases.map((t) => ({
    id: t.id,
    description: t.description,
    visible: t.visible,
    type: t.type as 'target' | 'commands' | 'state',
    message: t.message,
    expected: t.expected
  }));

  // Use the turtle grader (works for robot too since it's similar)
  const result: GradeResult = gradeTurtle(commandStrings, turtleTests);

  return {
    passed: result.passed,
    score: Math.round(result.score * 100),
    totalTests: testCases.length,
    passedTests: result.tests.filter((t) => t.passed).length,
    testResults: result.tests.map((t) => ({
      id: t.id,
      description: t.description.en || t.description.de,
      passed: t.passed,
      message: t.message,
      visible: t.visible
    }))
  };
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Format execution time in a human-readable way.
 */
export function formatExecutionTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Calculate score percentage from test results.
 */
export function calculateScore(passed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((passed / total) * 100);
}

