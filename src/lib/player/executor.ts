import type { Command, ICanvasEngine, IPositionEngine } from '$lib/canvas/types';
import {
	calculateScore as calculateScorePercent,
	gradeIoExercise,
	gradeVisualExercise,
	type GradingResult
} from '$lib/graders';
import {
	getSandboxExecutor,
	toUserFacingExecutionError,
	type ExecutionTrace,
	type SandboxCommand,
	type SandboxErrorType,
	type SandboxExecutionRequest
} from '$lib/sandbox';
import {
	createDefaultExercise,
	type Exercise,
	type RobotExercise,
	type IoTestCase,
	type TurtleExercise,
	type RobotTestCase,
	type TestCase,
	type TurtleTestCase
} from '$lib/types/exercise';

export type { GradingResult } from '$lib/graders';

const DEBUG = false;

function log(
	level: 'info' | 'debug' | 'error' | 'warn',
	message: string,
	data?: Record<string, unknown>
) {
	if (!DEBUG && level === 'debug') {
		return;
	}

	const suffix = data ? ` ${JSON.stringify(data)}` : '';
	console[level](`[Executor] ${message}${suffix}`);
}

export interface ExecutionResult {
	success: boolean;
	trace: ExecutionTrace;
	commands: Command[];
	finalState?: {
		x: number;
		y: number;
		angle: number;
	};
	stdout?: string;
	stderr?: string;
	prints?: string[];
	error?: string;
	errorType?: SandboxErrorType;
}

export interface SubmissionResult {
	execution: ExecutionResult;
	grading: GradingResult;
}

export interface CanvasConfig {
	width: number;
	height: number;
	gridSize: number;
}

function convertSandboxCommands(commands: SandboxCommand[] = []): Command[] {
	return commands.map((command) => ({
		type: command.type,
		args: command.args,
		timestamp: command.timestamp
	}));
}

function applyCommandsToEngine(
	sandboxCommands: SandboxCommand[] = [],
	engine: ICanvasEngine
): Command[] {
	engine.reset();

	for (const command of sandboxCommands) {
		const method = engine.api[command.type];
		if (typeof method === 'function') {
			method(...command.args);
		}
	}

	return engine.commands;
}

function createVisualTraceConfig(engine: ICanvasEngine) {
	if (!('state' in engine)) {
		return undefined;
	}

	const positionEngine = engine as IPositionEngine;
	return {
		initialState: {
			x: positionEngine.state.x,
			y: positionEngine.state.y,
			angle: positionEngine.state.angle
		},
		stepSize: engine.gridSize
	};
}

function buildExecutionRequest(
	exercise: Exercise,
	code: string,
	engine?: ICanvasEngine | null,
	overrides: Partial<SandboxExecutionRequest> = {}
): SandboxExecutionRequest {
	return {
		code,
		exerciseType: exercise.type,
		apiMethods: engine ? Object.keys(engine.api) : [],
		stdin:
			overrides.stdin ??
			(exercise.type === 'io'
				? (exercise.io.visibleExampleInput ??
					exercise.io.tests.find((test) => test.visible)?.stdin ??
					'')
				: undefined),
		seed: overrides.seed,
		timeout: overrides.timeout,
		maxCommands: overrides.maxCommands,
		maxIterations: overrides.maxIterations,
		visual:
			overrides.visual ??
			(exercise.type === 'io' || !engine ? undefined : createVisualTraceConfig(engine))
	};
}

function createExecutionResult(
	trace: ExecutionTrace,
	success: boolean,
	engine?: ICanvasEngine | null,
	error?: string,
	errorType?: SandboxErrorType
): ExecutionResult {
	const sandboxCommands = trace.commands ?? [];
	const commands = engine
		? applyCommandsToEngine(sandboxCommands, engine)
		: convertSandboxCommands(sandboxCommands);

	let finalState;
	if (engine && 'state' in engine) {
		const positionEngine = engine as IPositionEngine;
		finalState = {
			x: positionEngine.state.x,
			y: positionEngine.state.y,
			angle: positionEngine.state.angle
		};
	} else if (trace.finalState) {
		finalState = trace.finalState;
	}

	return {
		success,
		trace,
		commands,
		finalState,
		stdout: trace.stdout,
		stderr: trace.stderr,
		prints: trace.prints,
		error,
		errorType
	};
}

export async function executeCodeSandboxed(
	exercise: Exercise,
	code: string,
	engine?: ICanvasEngine | null,
	overrides: Partial<SandboxExecutionRequest> = {}
): Promise<ExecutionResult> {
	const request = buildExecutionRequest(exercise, code, engine, overrides);
	const sandbox = getSandboxExecutor();

	log('debug', 'Executing code in sandbox', {
		exerciseId: exercise.id,
		exerciseType: exercise.type,
		apiMethods: request.apiMethods,
		hasStdin: typeof request.stdin === 'string' && request.stdin.length > 0
	});

	const sandboxResult = await sandbox.execute(request);
	const userError = sandboxResult.success
		? undefined
		: toUserFacingExecutionError(sandboxResult.errorType, sandboxResult.error);

	return createExecutionResult(
		sandboxResult.trace,
		sandboxResult.success,
		engine,
		userError,
		sandboxResult.errorType
	);
}

export async function submitExerciseSolution(
	exercise: Exercise,
	code: string,
	engine?: ICanvasEngine | null
): Promise<SubmissionResult> {
	if (exercise.type === 'io') {
		const runs: Array<{ test: IoTestCase; execution: ExecutionResult }> = [];

		for (const test of exercise.io.tests) {
			runs.push({
				test,
				execution: await executeCodeSandboxed(exercise, code, null, {
					stdin: test.stdin,
					seed: test.seed
				})
			});
		}

		const representativeExecution = runs.find((run) => run.test.visible)?.execution ??
			runs[0]?.execution ?? {
				success: false,
				trace: { durationMs: 0, commands: [], stdout: '', stderr: '', prints: [] },
				commands: [],
				error: 'No test cases configured.',
				errorType: 'runtime'
			};

		return {
			execution: representativeExecution,
			grading: gradeIoExercise(exercise, runs)
		};
	}

	const execution = await executeCodeSandboxed(exercise, code, engine);
	return {
		execution,
		grading: gradeVisualExercise(exercise, execution)
	};
}

export function gradeExercise(
	commands: Command[],
	testCases: TestCase[],
	exerciseType: 'turtle' | 'robot' | 'io',
	canvasConfig?: CanvasConfig
): GradingResult {
	if (exerciseType === 'io') {
		return {
			passed: false,
			score: 0,
			totalTests: testCases.length,
			passedTests: 0,
			testResults: testCases.map((test) => ({
				id: test.id,
				description: test.description.en || test.description.de,
				passed: false,
				message: 'IO grading requires runtime-aware test execution.',
				visible: test.visible
			}))
		};
	}

	const safeCanvas = canvasConfig ?? { width: 400, height: 400, gridSize: 50 };

	if (exerciseType === 'robot') {
		const exercise = createDefaultExercise('robot') as RobotExercise;
		exercise.grid = {
			...exercise.grid,
			width: Math.max(1, Math.round(safeCanvas.width / Math.max(safeCanvas.gridSize, 1))),
			height: Math.max(1, Math.round(safeCanvas.height / Math.max(safeCanvas.gridSize, 1))),
			cellSize: safeCanvas.gridSize
		};
		exercise.grader = {
			...exercise.grader,
			testCases: testCases as RobotTestCase[]
		};
		exercise.config.canvas = {
			...exercise.config.canvas,
			width: safeCanvas.width,
			height: safeCanvas.height,
			gridSize: safeCanvas.gridSize
		};
		exercise.config.grid = { ...exercise.grid };
		exercise.config.grader = { ...exercise.grader };
		return gradeVisualExercise(exercise, { success: true, commands });
	}

	const exercise = createDefaultExercise('turtle') as TurtleExercise;
	exercise.canvas = {
		...exercise.canvas,
		width: safeCanvas.width,
		height: safeCanvas.height,
		gridSize: safeCanvas.gridSize
	};
	exercise.grader = {
		...exercise.grader,
		testCases: testCases as TurtleTestCase[]
	};
	exercise.config.canvas = { ...exercise.canvas };
	exercise.config.grader = { ...exercise.grader };
	return gradeVisualExercise(exercise, { success: true, commands });
}

export function formatExecutionTime(ms: number): string {
	if (ms < 1000) {
		return `${ms}ms`;
	}
	return `${(ms / 1000).toFixed(2)}s`;
}

export function calculateScore(passed: number, total: number): number {
	return calculateScorePercent(passed, total);
}
