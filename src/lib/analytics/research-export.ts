import type { AttemptActorType, AttemptLocale } from '$lib/types/attempt';
import type { ExerciseType } from '$lib/types/exercise';

export interface ResearchExportCourseInput {
	id: string;
	content: unknown;
}

export interface ResearchExportExerciseInput {
	id: string;
	type: ExerciseType;
	content: unknown;
}

export interface ResearchExportAttemptInput {
	id: string;
	exerciseId: string;
	userId?: string | null;
	clientId?: string | null;
	actorType: AttemptActorType;
	score: number;
	passed: boolean;
	startedAt: number;
	endedAt: number;
	locale: AttemptLocale;
	hintEventsJson: string;
	analyticsJson: string;
	createdAt: number;
}

export interface CourseResearchExport {
	schemaVersion: 1;
	kind: 'course-research-attempts';
	exportedAt: number;
	course: {
		id: string;
		title: string;
	};
	rows: Array<{
		attemptPseudonym: string;
		participantPseudonym: string;
		actorType: AttemptActorType;
		exerciseId: string;
		exerciseTitle: string;
		exerciseType: ExerciseType | 'unknown';
		score: number;
		passed: boolean;
		locale: AttemptLocale;
		durationMs: number;
		hintUsageCount: number;
		totalTests: number | null;
		passedTests: number | null;
		workspaceBlockCount: number | null;
		generatedCodeLength: number | null;
		submittedAt: number;
	}>;
}

function getLocalizedTitle(content: unknown, fallback: string): string {
	const value = content as { title?: { en?: unknown; de?: unknown } } | undefined;
	const title = value?.title;

	if (typeof title?.en === 'string' && title.en.trim()) {
		return title.en;
	}
	if (typeof title?.de === 'string' && title.de.trim()) {
		return title.de;
	}
	return fallback;
}

function parseJsonRecord(value: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

function countHintEvents(value: string): number {
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.length : 0;
	} catch {
		return 0;
	}
}

function numberOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toHex(bytes: ArrayBuffer): string {
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function pseudonymizeResearchId(
	scope: string,
	value: string,
	prefix: string
): Promise<string> {
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(`${scope}:${value}`)
	);
	return `${prefix}-${toHex(digest).slice(0, 24)}`;
}

export async function createCourseResearchExport(input: {
	course: ResearchExportCourseInput;
	exercises: ResearchExportExerciseInput[];
	attempts: ResearchExportAttemptInput[];
	exportedAt?: number;
}): Promise<CourseResearchExport> {
	const exerciseMap = new Map(input.exercises.map((exercise) => [exercise.id, exercise]));
	const scope = `course:${input.course.id}`;
	const exportedAt = input.exportedAt ?? Date.now();

	const rows = await Promise.all(
		input.attempts.map(async (attempt) => {
			const exercise = exerciseMap.get(attempt.exerciseId);
			const analytics = parseJsonRecord(attempt.analyticsJson);
			const participantId = attempt.userId ?? attempt.clientId ?? 'unknown-participant';

			return {
				attemptPseudonym: await pseudonymizeResearchId(scope, attempt.id, 'attempt'),
				participantPseudonym: await pseudonymizeResearchId(
					scope,
					`${attempt.actorType}:${participantId}`,
					'participant'
				),
				actorType: attempt.actorType,
				exerciseId: attempt.exerciseId,
				exerciseTitle: getLocalizedTitle(exercise?.content, attempt.exerciseId),
				exerciseType: (exercise?.type ?? 'unknown') as ExerciseType | 'unknown',
				score: attempt.score,
				passed: attempt.passed,
				locale: attempt.locale,
				durationMs: Math.max(0, attempt.endedAt - attempt.startedAt),
				hintUsageCount: countHintEvents(attempt.hintEventsJson),
				totalTests: numberOrNull(analytics.totalTests),
				passedTests: numberOrNull(analytics.passedTests),
				workspaceBlockCount: numberOrNull(analytics.workspaceBlockCount),
				generatedCodeLength: numberOrNull(analytics.generatedCodeLength),
				submittedAt: attempt.createdAt
			};
		})
	);

	return {
		schemaVersion: 1,
		kind: 'course-research-attempts',
		exportedAt,
		course: {
			id: input.course.id,
			title: getLocalizedTitle(input.course.content, input.course.id)
		},
		rows
	};
}
