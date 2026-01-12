import type { ICanvasEngine, IPositionEngine, Command } from '$lib/canvas/types';
import type { TestCase } from '$lib/types/exercise';
import { gradeTurtle, type GradeResult, type CanvasConfig } from '$lib/graders/turtle';
import { getSandboxExecutor, type SandboxExecutionResult, type SandboxCommand } from '$lib/sandbox';

// =============================================================================
// Logging Helper
// =============================================================================

const DEBUG = false; // Set to true to enable execution logging

function log(level: 'info' | 'debug' | 'error' | 'warn', message: string, data?: Record<string, unknown>) {
  if (!DEBUG && level === 'debug') return;
  const prefix = `[Executor]`;
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  console[level](`${prefix} ${message}${dataStr}`);
}

// =============================================================================
// Types
// =============================================================================

export interface ExecutionResult {
  success: boolean;
  error?: string;
  errorType?: 'timeout' | 'loop' | 'command_limit' | 'runtime' | 'security';
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
// Sandbox Code Execution (Secure)
// =============================================================================

/**
 * Execute generated Blockly code in a secure iframe sandbox.
 * This is the recommended way to execute student code.
 */
export async function executeCodeSandboxed(
  code: string,
  engine: ICanvasEngine
): Promise<ExecutionResult> {
  const startTime = performance.now();
  
  log('debug', 'Starting sandboxed code execution', { 
    codeLength: code.length,
    codePreview: code.substring(0, 100) + (code.length > 100 ? '...' : '')
  });

  // Reset the engine before execution
  engine.reset();

  // Get API method names from the engine
  const apiMethods = Object.keys(engine.api);
  
  log('debug', 'API methods available', { apiMethods });

  try {
    // Get or create sandbox executor
    const sandbox = getSandboxExecutor();
    
    // Execute code in sandbox
    const result: SandboxExecutionResult = await sandbox.execute(code, apiMethods);
    
    const executionTime = performance.now() - startTime;

    if (!result.success) {
      log('warn', 'Sandbox execution failed', {
        error: result.error,
        errorType: result.errorType,
        executionTimeMs: Math.round(executionTime * 100) / 100
      });

      // Convert error messages to user-friendly format
      let userError = result.error || 'Unknown execution error';
      
      if (result.errorType === 'timeout') {
        userError = 'Your code took too long to run. Check for infinite loops.';
      } else if (result.errorType === 'loop') {
        userError = 'Infinite loop detected. Your code ran too many iterations.';
      } else if (result.errorType === 'command_limit') {
        userError = 'Too many commands. Try using loops to make your code shorter.';
      }

      return {
        success: false,
        error: userError,
        errorType: result.errorType,
        commands: convertSandboxCommands(result.commands)
      };
    }

    // Apply commands to the engine for visualization
    const commands = applyCommandsToEngine(result.commands, engine);

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

    log('info', 'Sandboxed code execution successful', {
      executionTimeMs: Math.round(executionTime * 100) / 100,
      commandCount: commands.length,
      finalState: finalState || 'N/A'
    });

    return {
      success: true,
      commands,
      finalState
    };
  } catch (err) {
    const executionTime = performance.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : 'Unknown execution error';

    log('error', 'Sandbox execution error', {
      error: errorMessage,
      executionTimeMs: Math.round(executionTime * 100) / 100
    });

    return {
      success: false,
      error: errorMessage,
      errorType: 'runtime',
      commands: []
    };
  }
}

/**
 * Apply sandbox commands to an engine for visualization.
 * This replays the recorded commands on the actual engine.
 */
function applyCommandsToEngine(sandboxCommands: SandboxCommand[], engine: ICanvasEngine): Command[] {
  const api = engine.api;
  
  for (const cmd of sandboxCommands) {
    const method = api[cmd.type];
    if (typeof method === 'function') {
      method(...cmd.args);
    } else {
      log('warn', `Unknown command type: ${cmd.type}`);
    }
  }
  
  return engine.commands;
}

/**
 * Convert sandbox commands to engine command format.
 */
function convertSandboxCommands(sandboxCommands: SandboxCommand[]): Command[] {
  return sandboxCommands.map(cmd => ({
    type: cmd.type,
    args: cmd.args,
    timestamp: cmd.timestamp
  }));
}

// =============================================================================
// Local Code Execution (Legacy/Fallback)
// =============================================================================

/**
 * Execute generated Blockly code against an engine locally.
 * WARNING: This uses Function() which is less secure than sandbox execution.
 * Use executeCodeSandboxed() for student code execution.
 * 
 * @deprecated Use executeCodeSandboxed instead
 */
export function executeCode(
  code: string,
  engine: ICanvasEngine
): ExecutionResult {
  const startTime = performance.now();
  
  log('debug', 'Starting local code execution', { 
    codeLength: code.length,
    codePreview: code.substring(0, 100) + (code.length > 100 ? '...' : '')
  });

  // Reset the engine before execution
  engine.reset();

  // Get the API from the engine
  const api = engine.api;

  // Add loop protection
  const maxIterations = 10000;

  const protectedCode = code.replace(
    /while\s*\(/g,
    `while (++_loopCounter < ${maxIterations} && (`
  ).replace(
    /for\s*\(/g,
    `for (_loopCounter = 0; _loopCounter < ${maxIterations} && (`
  );

  log('debug', 'Loop protection applied', { 
    hasLoops: protectedCode !== code 
  });

  try {
    // Create a sandboxed execution context
    const sandboxedFunction = new Function(
      'api',
      `
			"use strict";
			let _loopCounter = 0;
			${protectedCode}
		`
    );

    sandboxedFunction(api);

    const executionTime = performance.now() - startTime;

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

    log('info', 'Local code execution successful', {
      executionTimeMs: Math.round(executionTime * 100) / 100,
      commandCount: engine.commands.length,
      finalState: finalState || 'N/A'
    });

    return {
      success: true,
      commands: engine.commands,
      finalState
    };
  } catch (err) {
    const executionTime = performance.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : 'Unknown execution error';

    // Check for loop protection trigger
    if (errorMessage.includes('Maximum call stack') || errorMessage.includes('_loopCounter')) {
      log('warn', 'Infinite loop detected', {
        executionTimeMs: Math.round(executionTime * 100) / 100,
        maxIterations
      });
      return {
        success: false,
        error: 'Infinite loop detected. Your code ran too long.',
        errorType: 'loop',
        commands: engine.commands
      };
    }

    log('error', 'Local code execution failed', {
      error: errorMessage,
      executionTimeMs: Math.round(executionTime * 100) / 100,
      stack: err instanceof Error ? err.stack : undefined
    });

    return {
      success: false,
      error: errorMessage,
      errorType: 'runtime',
      commands: engine.commands
    };
  }
}

// =============================================================================
// Grading
// =============================================================================

/**
 * Grade an exercise based on test cases and execution result.
 * @param commands - The commands executed by the student's code
 * @param testCases - The test cases to evaluate against
 * @param exerciseType - Type of exercise ('turtle', 'robot', or 'io')
 * @param canvasConfig - Canvas configuration for proper position calculation
 */
export function gradeExercise(
  commands: Command[],
  testCases: TestCase[],
  exerciseType: 'turtle' | 'robot' | 'io',
  canvasConfig?: CanvasConfig
): GradingResult {
  log('debug', 'Starting grading', {
    exerciseType,
    commandCount: commands.length,
    testCaseCount: testCases.length,
    canvasConfig
  });

  if (exerciseType === 'io') {
    log('warn', 'IO grading not yet implemented');
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

  log('debug', 'Commands converted for grading', {
    commands: commandStrings
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

  // Use the turtle grader with canvas config (works for robot too since it's similar)
  const result: GradeResult = gradeTurtle(commandStrings, turtleTests, canvasConfig);

  const gradingResult = {
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

  log('info', 'Grading complete', {
    passed: gradingResult.passed,
    score: gradingResult.score,
    passedTests: gradingResult.passedTests,
    totalTests: gradingResult.totalTests
  });

  return gradingResult;
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
