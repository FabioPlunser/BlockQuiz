import { setContext, getContext } from 'svelte';
import type { Exercise } from '$lib/types/exercise';
import type { AttemptCapture, HintRevealEvent } from '$lib/types/attempt';
import type { GradingResult } from '$lib/player/executor';
import { getExecutionState } from './execution.svelte';

type Options = {
	initialResult?: GradingResult | null;
};

export class ExercisePlayerState {
	readonly exercise: Exercise;
	private executionState = getExecutionState();
	private initialResult: GradingResult | null = null;

	hintEvents = $state<HintRevealEvent[]>([]);
	showInitialResult = $state(true);

	result = $derived(this.executionState.result);
	isSubmitting = $derived(this.executionState.isSubmitting);
	collision = $derived(this.executionState.collision);
	displayedResult = $derived(
		this.result ?? (this.showInitialResult ? this.initialResult : null)
	);

	constructor(exercise: Exercise, options: Options = {}) {
		this.exercise = exercise;
		this.initialResult = options.initialResult ?? null;
	}

	handleHintEventsChange(events: HintRevealEvent[]) {
		this.hintEvents = [...events];
	}

	handleRetry() {
		this.showInitialResult = false;
		this.executionState.handleRetry();
	}

	buildCapture(input: {
		workspaceXml: string;
		generatedCode: string;
		result: GradingResult;
		locale: 'de' | 'en';
	}): AttemptCapture {
		this.showInitialResult = false;
		return {
			workspaceXml: input.workspaceXml,
			generatedCode: input.generatedCode,
			locale: input.locale,
			hintEventsJson: JSON.stringify(this.hintEvents),
			analyticsJson: JSON.stringify({
				exerciseType: this.exercise.type,
				totalTests: input.result.totalTests,
				passedTests: input.result.passedTests,
				hintUsageCount: this.hintEvents.length,
				workspaceBlockCount: ExercisePlayerState.getWorkspaceBlockCount(input.workspaceXml),
				generatedCodeLength: input.generatedCode.length,
				submittedAt: Date.now()
			})
		};
	}

	static getWorkspaceBlockCount(xml: string): number {
		return xml.match(/<block\b/g)?.length ?? 0;
	}
}

const EXERCISE_PLAYER_KEY = Symbol('exercise-player');

export const setExercisePlayer = (player: ExercisePlayerState) =>
	setContext(EXERCISE_PLAYER_KEY, player);

export const getExercisePlayer = () =>
	getContext<ExercisePlayerState>(EXERCISE_PLAYER_KEY);
