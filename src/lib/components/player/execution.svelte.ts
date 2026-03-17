import type { Exercise } from '$lib/types/exercise';
import type { ICanvasEngine } from '$lib/canvas/types';
import type { ExecutionTrace } from '$lib/sandbox';
import type { GradingResult } from '$lib/player/executor';
import { executeCodeSandboxed, submitExerciseSolution } from '$lib/player/executor';
import { Turtle } from '$lib/canvas/Turtle.svelte';
import { Robot } from '$lib/canvas/Robot.svelte';
import toast from '$lib/toaster';

// Logging helper
const DEBUG = false;
function log(level: 'info' | 'debug' | 'error' | 'warn', message: string, data?: Record<string, unknown>) {
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

	// Initialize engine based on exercise
	initialize(exercise: Exercise, getCode: () => string) {
		log('info', 'Initializing execution state', {
			exerciseId: exercise.id,
			exerciseType: exercise.type,
			canvasSize: exercise.config.canvas
		});

		this._exercise = exercise;
		this._getCode = getCode;
		this._trace = null;
		this._result = null;
		this._executionError = false;

		const { width, height } = exercise.config.canvas;
		if (exercise.type === 'turtle') {
			this._engine = new Turtle(width, height);
			log('debug', 'Created Turtle engine', { width, height });
		} else if (exercise.type === 'robot') {
			this._engine = new Robot(width, height);
			log('debug', 'Created Robot engine', { width, height });
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
		this._result = null;
		this._executionError = false;

		try {
			const code = this._getCode();
			log('debug', 'Code retrieved from workspace', { codeLength: code.length });

			if (!code.trim()) {
				log('warn', 'Empty code - nothing to run');
				toast.error('No code to run. Add some blocks to your workspace.');
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
				toast.error('No code to submit. Add some blocks first.');
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

			this._result = submission.grading;
			if (onSubmit) {
				onSubmit(submission.grading);
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
