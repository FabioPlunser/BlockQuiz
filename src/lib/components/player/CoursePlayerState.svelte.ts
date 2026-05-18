import { SvelteMap } from 'svelte/reactivity';
import { setContext, getContext } from 'svelte';
import {
	getCourse,
	getCourseExercises,
	getCourseProgress,
	submitAttempt
} from '$lib/remote/courses.remote';
import type { Exercise, LocalizedString } from '$lib/types/exercise';
import type { AttemptCapture, AttemptSubmission } from '$lib/types/attempt';
import type { GradingResult } from '$lib/player/executor';
import type { BadgeKey } from '$lib/achievements/rules';

export type ExerciseProgress = {
	passed: boolean;
	bestScore: number;
	attemptCount: number;
};

export type ExerciseSnapshot = {
	workspaceXml?: string;
	resultJson?: string;
};

export type ExerciseResult = {
	passed: boolean;
	score: number;
	attemptCount: number;
};

export type PersistAttemptFn = (submission: AttemptSubmission) => Promise<{
	success?: boolean;
	grading?: GradingResult;
	newBadges?: BadgeKey[];
} | void>;

type Options = {
	initialExerciseIndex?: number;
	onExerciseChange?: (payload: { exerciseId?: string; exerciseIndex: number }) => void;

	/**
	 * 'student' (default) authenticates via the standard remote queries and
	 * persists attempts through `submitAttempt`. 'guest' uses the public
	 * remote queries and the caller-provided `persistAttempt` / initial
	 * progress (typically backed by localStorage). Badges are never awarded
	 * in guest mode.
	 */
	mode?: 'student' | 'guest';

	/** Required in guest mode: the public course summary (already loaded). */
	guestCourse?: CourseData;
	/** Optional override for fetching exercises (defaults to the auth-required query). */
	loadExercises?: (courseId: string) => Promise<Exercise[]>;
	/** Optional override for persistence (defaults to `submitAttempt`). */
	persistAttempt?: PersistAttemptFn;
	/** Pre-populate per-exercise progress (used by guest mode). */
	initialProgress?: Record<string, ExerciseProgress>;
	/** Pre-populate latest workspace/result snapshots (used by guest mode). */
	initialSnapshots?: Record<string, ExerciseSnapshot>;
};

type CourseData = Awaited<ReturnType<typeof getCourse>>;

export class CoursePlayerState {
	readonly courseId: string;
	private options: Options;

	course = $state<CourseData | null>(null);
	exercises = $state<Exercise[]>([]);
	exerciseResults = $state(new SvelteMap<string, ExerciseResult>());
	initialSnapshots = $state<Record<string, ExerciseSnapshot>>({});

	currentExerciseIndex = $state(0);
	startTime = $state(Date.now());
	courseStartTime = $state(Date.now());

	totalHintsUsed = $state(0);
	summaryDurationMs = $state(0);
	pendingBadges = $state<BadgeKey[]>([]);
	showCompletionModal = $state(false);

	loading = $state(true);
	error = $state<Error | null>(null);

	currentExercise = $derived(this.exercises[this.currentExerciseIndex]);
	hasNextExercise = $derived(this.currentExerciseIndex < this.exercises.length - 1);
	completedCount = $derived(
		[...this.exerciseResults.values()].filter((r) => r.passed).length
	);
	progressPercent = $derived(
		this.exercises.length > 0
			? Math.round((this.completedCount / this.exercises.length) * 100)
			: 0
	);
	summaryExercises = $derived(
		[...this.exerciseResults.values()].filter((r) => r.passed).length
	);
	summaryPerfect = $derived(
		[...this.exerciseResults.values()].filter((r) => r.passed && r.score === 100).length
	);
	courseTitle = $derived(
		(this.course?.content as { title?: LocalizedString } | undefined)?.title ?? { de: '', en: '' }
	);
	currentSnapshotResult = $derived(
		this.currentExercise
			? this.parseSnapshotResult(this.initialSnapshots[this.currentExercise.id]?.resultJson)
			: null
	);

	constructor(courseId: string, options: Options = {}) {
		this.courseId = courseId;
		this.options = options;
	}

	async init() {
		this.loading = true;
		this.error = null;
		try {
			if (this.options.mode === 'guest') {
				const exercises = this.options.loadExercises
					? await this.options.loadExercises(this.courseId)
					: [];
				this.course = (this.options.guestCourse ?? null) as CourseData | null;
				this.exercises = exercises;
				this.exerciseResults = this.buildResults(this.options.initialProgress ?? {});
				this.initialSnapshots = this.options.initialSnapshots ?? {};
			} else {
				const [course, exercises, progress] = await Promise.all([
					getCourse(this.courseId),
					getCourseExercises(this.courseId),
					getCourseProgress(this.courseId)
				]);
				this.course = course;
				this.exercises = exercises;
				this.exerciseResults = this.buildResults(progress.exerciseProgress ?? {});
				this.initialSnapshots = progress.latestSnapshots ?? {};
			}
			this.currentExerciseIndex = this.pickInitialIndex();
			this.courseStartTime = Date.now();
			this.startTime = Date.now();
		} catch (e) {
			this.error = e instanceof Error ? e : new Error('Failed to load course');
		} finally {
			this.loading = false;
		}
	}

	async handleSubmit({ result, capture }: { result: GradingResult; capture: AttemptCapture }) {
		const exercise = this.currentExercise;
		if (!exercise) return;

		try {
			const previous = this.exerciseResults.get(exercise.id);
			const endedAt = Date.now();

			const submission = {
				exerciseId: exercise.id,
				workspaceXml: capture.workspaceXml,
				generatedCode: capture.generatedCode,
				resultJson: JSON.stringify(result),
				locale: capture.locale,
				startedAt: this.startTime,
				endedAt,
				score: result.score,
				passed: result.passed,
				hintEventsJson: capture.hintEventsJson,
				analyticsJson: capture.analyticsJson
			} satisfies AttemptSubmission;

			const persisted = this.options.persistAttempt
				? await this.options.persistAttempt(submission)
				: await submitAttempt(submission);
			const grading = persisted?.grading ?? result;

			this.exerciseResults.set(exercise.id, {
				passed: previous?.passed || grading.passed,
				score: Math.max(previous?.score ?? 0, grading.score),
				attemptCount: (previous?.attemptCount ?? 0) + 1
			});

			if (persisted?.newBadges?.length) {
				this.pendingBadges = [...this.pendingBadges, ...persisted.newBadges];
			}

			this.totalHintsUsed += this.countHintEvents(capture.hintEventsJson);

			const newCompletedCount = [...this.exerciseResults.values()].filter((r) => r.passed)
				.length;
			if (
				!previous?.passed &&
				grading.passed &&
				newCompletedCount === this.exercises.length &&
				this.exercises.length > 0
			) {
				this.summaryDurationMs = Date.now() - this.courseStartTime;
				this.showCompletionModal = true;
			}
		} catch (err) {
			console.error('Failed to submit attempt:', err);
		}
	}

	goToNext() {
		if (!this.hasNextExercise) return;
		this.currentExerciseIndex += 1;
		this.startTime = Date.now();
		this.notifyExerciseChange();
	}

	goToExercise(index: number) {
		this.currentExerciseIndex = index;
		this.startTime = Date.now();
		this.notifyExerciseChange();
	}

	dismissBadges() {
		this.pendingBadges = [];
	}

	closeCompletion() {
		this.showCompletionModal = false;
	}

	private buildResults(progress: Record<string, ExerciseProgress>) {
		return new SvelteMap<string, ExerciseResult>(
			Object.entries(progress).map(([id, value]) => [
				id,
				{
					passed: value.passed,
					score: value.bestScore,
					attemptCount: value.attemptCount
				}
			])
		);
	}

	private pickInitialIndex() {
		const hint = this.options.initialExerciseIndex;
		if (typeof hint === 'number' && hint >= 0) {
			return Math.min(hint, Math.max(this.exercises.length - 1, 0));
		}
		const first = this.exercises.findIndex(
			(ex) => !this.exerciseResults.get(ex.id)?.passed
		);
		return first >= 0 ? first : 0;
	}

	private notifyExerciseChange() {
		this.options.onExerciseChange?.({
			exerciseId: this.currentExercise?.id,
			exerciseIndex: this.currentExerciseIndex
		});
	}

	private countHintEvents(json: string | undefined) {
		if (!json) return 0;
		try {
			const parsed = JSON.parse(json);
			return Array.isArray(parsed) ? parsed.length : 0;
		} catch {
			return 0;
		}
	}

	private parseSnapshotResult(resultJson: string | undefined): GradingResult | null {
		if (!resultJson) return null;
		try {
			const parsed = JSON.parse(resultJson) as Partial<GradingResult>;
			if (
				typeof parsed.passed !== 'boolean' ||
				typeof parsed.score !== 'number' ||
				typeof parsed.totalTests !== 'number' ||
				typeof parsed.passedTests !== 'number' ||
				!Array.isArray(parsed.testResults)
			) {
				return null;
			}
			return parsed as GradingResult;
		} catch {
			return null;
		}
	}
}

const COURSE_PLAYER_KEY = Symbol('course-player');

export const setCoursePlayer = (player: CoursePlayerState) =>
	setContext(COURSE_PLAYER_KEY, player);

export const getCoursePlayer = () => getContext<CoursePlayerState>(COURSE_PLAYER_KEY);
