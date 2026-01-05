import type { Exercise } from '$lib/types/exercise';
import type { ICanvasEngine } from '$lib/canvas/types';
import type { GradingResult } from '$lib/player/executor';
import { executeCode, gradeExercise } from '$lib/player/executor';
import { Turtle } from '$lib/canvas/Turtle.svelte';
import { Robot } from '$lib/canvas/Robot.svelte';
import toast from '$lib/toaster';

class ExecutionState {
	private _engine = $state<ICanvasEngine | null>(null);
	private _isRunning = $state(false);
	private _isSubmitting = $state(false);
	private _result = $state<GradingResult | null>(null);
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

	get executionError() {
		return this._executionError;
	}

	// Initialize engine based on exercise
	initialize(exercise: Exercise, getCode: () => string) {
		this._exercise = exercise;
		this._getCode = getCode;

		const { width, height } = exercise.config.canvas;
		if (exercise.type === 'turtle') {
			this._engine = new Turtle(width, height);
		} else if (exercise.type === 'robot') {
			this._engine = new Robot(width, height);
		}
	}

	// Reset state for new exercise
	reset() {
		if (this._engine) {
			this._engine.reset();
		}
		this._result = null;
		this._executionError = false;
		this._isRunning = false;
		this._isSubmitting = false;
	}

	async handleRun() {
		if (!this._engine || !this._getCode) return;

		this._isRunning = true;
		this._result = null;

		try {
			const code = this._getCode();
			if (!code.trim()) {
				toast.error('No code to run. Add some blocks to your workspace.');
				this._executionError = true;
				this._isRunning = false;
				return;
			}

			const execResult = executeCode(code, this._engine);

			if (!execResult.success) {
				toast.error(execResult.error || 'Execution failed');
				this._executionError = true;
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Unknown error');
			this._executionError = true;
		} finally {
			this._isRunning = false;
		}
	}

	handleReset() {
		if (!this._engine) return;
		this._engine.reset();
		this._result = null;
	}

	async handleSubmit(onSubmit?: (result: GradingResult) => void) {
		if (!this._engine || !this._getCode || !this._exercise) return;

		this._isSubmitting = true;
		this._executionError = false;

		try {
			const code = this._getCode();
			if (!code.trim()) {
				toast.error('No code to submit. Add some blocks first.');
				this._executionError = true;
				this._isSubmitting = false;
				return;
			}

			// Run the code first
			const execResult = executeCode(code, this._engine);

			if (!execResult.success) {
				toast.error(execResult.error || 'Execution failed');
				this._executionError = true;
				this._isSubmitting = false;
				return;
			}

			// Grade the result
			const gradingResult = gradeExercise(
				execResult.commands,
				this._exercise.config.grader.testCases,
				this._exercise.type
			);

			this._result = gradingResult;
			if (onSubmit) {
				onSubmit(gradingResult);
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Unknonw error');
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
