import type { Exercise } from '$lib/types/exercise';
import type { ICanvasEngine } from '$lib/canvas/types';
import type { ExecutionTrace } from '$lib/sandbox';
import type { GradingResult } from '$lib/player/executor';
import { executeCodeSandboxed, submitExerciseSolution } from '$lib/player/executor';
import { Turtle } from '$lib/canvas/Turtle.svelte';
import { Robot } from '$lib/canvas/Robot.svelte';
import toast from '$lib/toaster';
import { i18n } from '$lib/i18n/index.svelte';

// Logging helper
const DEBUG = false;
function log(
	level: 'info' | 'debug' | 'error' | 'warn',
	message: string,
	data?: Record<string, unknown>
) {
	if (!DEBUG && level === 'debug') return;
	const prefix = `[ExecutionState]`;
	const dataStr = data ? ` ${JSON.stringify(data)}` : '';
	console[level](`${prefix} ${message}${dataStr}`);
}

class ExecutionState {
	private _engine = $state<ICanvasEngine | null>(null);
	private _isRunning = $state(false);
	private _isSubmitting = $state(false);
	private _result = $state<GradingResult | null>(null);
	private _trace = $state<ExecutionTrace | null>(null);
	private _executionError = $state<boolean>(false);
	private _getCode: (() => string) | null = null;
	private _exercise: Exercise | null = null;

	// Getters
	get engine() {
		return this._engine;
	}

	get isRunning() {
		return this._isRunning;
	}

	get isSubmitting() {
		return this._isSubmitting;
	}

	get result() {
		return this._result;
	}

	get trace() {
		return this._trace;
	}

	get executionError() {
		return this._executionError;
	}

	/** Wall collision point if the engine hit a wall during the last run/submit. */
	get collision(): { x: number; y: number } | null {
		const engine = this._engine as { collision?: { x: number; y: number } | null } | null;
		return engine?.collision ?? null;
	}

	// Initialize engine based on exercise
	initialize(exercise: Exercise, getCode: () => string) {
		log('info', 'Initializing execution state', {
			exerciseId: exercise.id,
			exerciseType: exercise.type
		});

		this._exercise = exercise;
		this._getCode = getCode;
		this._trace = null;
		this._result = null;
		this._executionError = false;

		if (exercise.type === 'turtle') {
			const { width, height } = exercise.canvas;
			const engine = new Turtle(width, height);
			engine.gridSize = exercise.canvas.gridSize;
			engine.walls = exercise.canvas.walls ?? [];
			engine.targets = exercise.canvas.targets ?? [];
			engine.appleTolerance = exercise.grader?.appleTolerance ?? 0.5;
			if (exercise.canvas.start) {
				engine.state = { ...engine.state, x: exercise.canvas.start.x, y: exercise.canvas.start.y };
			}
			this._engine = engine;
			log('debug', 'Created Turtle engine', { width, height });
		} else if (exercise.type === 'robot') {
			const width = exercise.grid.width * exercise.grid.cellSize;
			const height = exercise.grid.height * exercise.grid.cellSize;
			const engine = new Robot(width, height, {
				start: exercise.grid.start,
				direction: exercise.grid.direction
			});
			engine.gridSize = exercise.grid.cellSize;
			this._engine = engine;
			log('debug', 'Created Robot engine', {
				width,
				height,
				start: exercise.grid.start,
				direction: exercise.grid.direction
			});
		} else {
			this._engine = null;
		}
	}

	// Reset state for new exercise
	reset() {
		log('debug', 'Resetting execution state', { exerciseId: this._exercise?.id });
		if (this._engine) {
			this._engine.reset();
		}
		this._result = null;
		this._trace = null;
		this._executionError = false;
		this._isRunning = false;
		this._isSubmitting = false;
	}

	/**
	 * Replay step support: reset the engine and re-execute the first `step`
	 * commands from the most recent trace. Used by the learner-facing Replay
	 * panel to step through a program one command at a time.
	 *
	 * Safe to call repeatedly. Returns the actual number of commands applied
	 * (clamped to the length of the trace).
	 */
	seekToCommand(step: number): number {
		if (!this._engine) return 0;
		const commands = this._trace?.commands ?? [];
		const target = Math.max(0, Math.min(step, commands.length));
		this._engine.reset();
		// Dispatch each command by name against the engine's own API — the same
		// mechanism the live run uses (see applyCommandsToEngine in executor.ts).
		// A hardcoded switch here previously ignored robot commands (step,
		// turn_left, turn_right), so the robot never moved while stepping.
		const api = this._engine.api as Record<string, (...args: unknown[]) => void>;
		for (let i = 0; i < target; i++) {
			const cmd = commands[i];
			const method = api[cmd.type];
			if (typeof method === 'function') {
				method(...(cmd.args ?? []));
			}
		}
		return target;
	}

	get commandCount(): number {
		return this._trace?.commands?.length ?? 0;
	}

	async handleRun() {
		log('debug', 'handleRun called', {
			hasEngine: !!this._engine,
			hasGetCode: !!this._getCode,
			exerciseId: this._exercise?.id
		});

		if (!this._getCode || !this._exercise) {
			log('warn', 'Cannot run - missing exercise context');
			return;
		}

		this._isRunning = true;
		this._executionError = false;

		try {
			const code = this._getCode();
			log('debug', 'Code retrieved from workspace', { codeLength: code.length });

			if (!code.trim()) {
				log('warn', 'Empty code - nothing to run');
				toast.error(i18n.player_no_code);
				this._executionError = true;
				this._isRunning = false;
				return;
			}

			log('info', 'Executing code in sandbox...', { exerciseId: this._exercise?.id });

			// Execute code in secure sandbox
			const execResult = await executeCodeSandboxed(this._exercise, code, this._engine);
			this._trace = execResult.trace;

			if (!execResult.success) {
				log('error', 'Execution failed', {
					error: execResult.error,
					errorType: execResult.errorType
				});
				toast.error(execResult.error || 'Execution failed');
				this._executionError = true;
			} else {
				log('info', 'Execution successful', {
					commandCount: execResult.commands.length,
					stdout: execResult.stdout ?? ''
				});
			}
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : 'Unknown error';
			log('error', 'Unexpected error during run', { error: errorMsg });
			toast.error(errorMsg);
			this._executionError = true;
		} finally {
			this._isRunning = false;
		}
	}

	handleReset() {
		if (this._engine) {
			this._engine.reset();
		}
		this._result = null;
		this._trace = null;
		this._executionError = false;
	}

	async handleSubmit(onSubmit?: (result: GradingResult) => void) {
		log('debug', 'handleSubmit called', {
			hasEngine: !!this._engine,
			hasGetCode: !!this._getCode,
			hasExercise: !!this._exercise,
			exerciseId: this._exercise?.id
		});

		if (!this._getCode || !this._exercise) {
			log('warn', 'Cannot submit - missing getCode or exercise');
			return;
		}

		this._isSubmitting = true;
		this._executionError = false;

		try {
			const code = this._getCode();
			log('debug', 'Code retrieved for submission', { codeLength: code.length });

			if (!code.trim()) {
				log('warn', 'Empty code - nothing to submit');
				toast.error(i18n.player_no_code_submit);
				this._executionError = true;
				this._isSubmitting = false;
				return;
			}

			log('info', 'Executing code in sandbox for submission...', { exerciseId: this._exercise.id });

			const submission = await submitExerciseSolution(this._exercise, code, this._engine);
			this._trace = submission.execution.trace;

			if (!submission.execution.success && this._exercise.type !== 'io') {
				log('error', 'Execution failed during submission', {
					error: submission.execution.error,
					errorType: submission.execution.errorType
				});
				toast.error(submission.execution.error || 'Execution failed');
				this._executionError = true;
				this._isSubmitting = false;
				return;
			}

			log('debug', 'Submission executed, grading finished', {
				commandCount: submission.execution.commands.length,
				stdout: submission.execution.stdout ?? '',
				testCaseCount:
					this._exercise.type === 'io'
						? this._exercise.io.tests.length
						: this._exercise.config.grader.testCases.length
			});

			log('info', 'Grading complete', {
				exerciseId: this._exercise.id,
				passed: submission.grading.passed,
				score: submission.grading.score,
				passedTests: submission.grading.passedTests,
				totalTests: submission.grading.totalTests
			});

			const collidedPoint = this.collision;
			const grading = collidedPoint
				? { ...submission.grading, passed: false, score: 0 }
				: submission.grading;
			this._result = grading;
			if (collidedPoint) this._executionError = true;
			if (onSubmit) {
				onSubmit(grading);
			}
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : 'Unknown error';
			log('error', 'Unexpected error during submission', { error: errorMsg });
			toast.error(errorMsg);
			this._executionError = true;
		} finally {
			this._isSubmitting = false;
		}
	}

	handleRetry() {
		this.handleReset();
	}
}

// Singleton instance
let executionStateInstance: ExecutionState | null = null;

export function getExecutionState(): ExecutionState {
	if (!executionStateInstance) {
		executionStateInstance = new ExecutionState();
	}
	return executionStateInstance;
}

// Export convenience getters for reactive access
export const executionState = getExecutionState();
