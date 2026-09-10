import { browser } from '$app/environment';
import {
	createEmptyGuestProgress,
	normalizeGuestProgress,
	sanitizeGuestProgress
} from '$lib/guest-progress/merge';
import type {
	GuestAttemptDraft,
	GuestAttemptSnapshot,
	GuestCourseProgress,
	GuestProgressExport
} from '$lib/guest-progress/types';
import {
	evaluateBadges,
	type BadgeKey,
	type AttemptSignal,
	type HistorySnapshot
} from '$lib/achievements/rules';

const STORAGE_KEY = 'blockquiz.guest-progress.v1';

function createId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyProgress(clientId = createId()): GuestProgressExport {
	return createEmptyGuestProgress(clientId);
}

function persist(progress: GuestProgressExport): GuestProgressExport {
	const normalized = normalizeGuestProgress(progress);

	if (browser) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
	}

	return normalized;
}

export function readGuestProgress(): GuestProgressExport {
	if (!browser) {
		return createEmptyProgress('guest-browser-required');
	}

	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) {
		const progress = createEmptyProgress();
		return persist(progress);
	}

	try {
		return persist(sanitizeGuestProgress(JSON.parse(raw), createId));
	} catch (error) {
		console.error('Failed to parse guest progress:', error);
		const fallback = createEmptyProgress();
		return persist(fallback);
	}
}

export function writeGuestProgress(progress: GuestProgressExport): GuestProgressExport {
	return persist(progress);
}

export function syncGuestCourseContext(
	courseId: string,
	exerciseIds: string[]
): GuestProgressExport {
	const progress = readGuestProgress();
	const existingCourse = progress.courses.find((course) => course.courseId === courseId);

	if (existingCourse) {
		existingCourse.exerciseIds = Array.from(
			new Set([...existingCourse.exerciseIds, ...exerciseIds])
		);
	} else {
		progress.courses.push({
			courseId,
			exerciseIds: [...exerciseIds],
			exerciseProgress: {},
			completedCount: 0,
			exerciseCount: exerciseIds.length,
			progress: 0,
			updatedAt: Date.now()
		});
	}

	return persist(progress);
}

export function setGuestCourseResume(
	courseId: string,
	exerciseIds: string[],
	exerciseIndex: number,
	exerciseId?: string
): GuestProgressExport {
	const progress = syncGuestCourseContext(courseId, exerciseIds);
	const course = progress.courses.find((entry) => entry.courseId === courseId);

	if (!course) {
		return progress;
	}

	course.lastExerciseIndex = exerciseIndex;
	course.lastExerciseId = exerciseId;
	course.updatedAt = Date.now();
	return persist(progress);
}

export function recordGuestAttempt(draft: GuestAttemptDraft): GuestProgressExport {
	const progress = syncGuestCourseContext(draft.courseId, draft.exerciseIds);
	const now = Date.now();

	const attempt: GuestAttemptSnapshot = {
		...draft.attempt,
		id: draft.attempt.id ?? createId(),
		clientId: progress.clientId,
		actorType: 'guest',
		createdAt: draft.attempt.createdAt ?? draft.attempt.endedAt ?? now
	};

	const existingIndex = progress.attempts.findIndex((entry) => entry.id === attempt.id);
	if (existingIndex >= 0) {
		progress.attempts[existingIndex] = attempt;
	} else {
		progress.attempts.push(attempt);
	}

	const course = progress.courses.find((entry) => entry.courseId === draft.courseId);
	if (course) {
		course.lastExerciseId = draft.exerciseIds[draft.exerciseIndex] ?? draft.attempt.exerciseId;
		course.lastExerciseIndex = draft.exerciseIndex;
		course.updatedAt = now;
	}

	return persist(progress);
}

export function clearGuestProgress(): GuestProgressExport {
	const existing = readGuestProgress();
	return persist(createEmptyProgress(existing.clientId));
}

export function getGuestCourseProgress(courseId: string): GuestCourseProgress | undefined {
	return readGuestProgress().courses.find((course) => course.courseId === courseId);
}

export function getGuestLatestAttemptsByExercise(
	exerciseIds: string[]
): Record<string, GuestAttemptSnapshot> {
	const snapshots: Record<string, GuestAttemptSnapshot> = {};

	for (const attempt of readGuestProgress().attempts) {
		if (!exerciseIds.includes(attempt.exerciseId)) {
			continue;
		}

		const current = snapshots[attempt.exerciseId];
		if (!current || attempt.createdAt >= current.createdAt) {
			snapshots[attempt.exerciseId] = attempt;
		}
	}

	return snapshots;
}

function countHintEvents(value: string | undefined): number {
	if (!value) return 0;
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.length : 0;
	} catch {
		return 0;
	}
}

/**
 * Evaluate and persist achievement badges for a guest attempt that just landed.
 * Mirrors the server-side logic in `evaluateAndPersistBadges` but works
 * entirely against the local guest store. Returns the keys of the newly
 * earned badges, ready to drive a UI unlock toast.
 */
export function evaluateAndPersistGuestBadges(input: {
	courseId: string;
	exerciseIds: string[];
	attemptSignal: AttemptSignal;
	hintEventsJson?: string;
}): BadgeKey[] {
	const progress = readGuestProgress();
	const earnedRows = progress.badges ?? [];
	const earned = new Set<BadgeKey>(earnedRows.map((row) => row.badgeKey));

	const sortedAttempts = [...progress.attempts].sort((a, b) => b.createdAt - a.createdAt);

	let currentPassStreak = 0;
	for (const attempt of sortedAttempts) {
		if (attempt.passed) currentPassStreak += 1;
		else break;
	}

	const localesUsed = new Set<'de' | 'en'>();
	for (const attempt of sortedAttempts) {
		if (attempt.passed && (attempt.locale === 'de' || attempt.locale === 'en')) {
			localesUsed.add(attempt.locale);
		}
	}

	let completesCourse = false;
	if (input.attemptSignal.passed) {
		const passingExerciseIds = new Set(
			progress.attempts.filter((a) => a.passed).map((a) => a.exerciseId)
		);
		completesCourse =
			input.exerciseIds.length > 0 && input.exerciseIds.every((id) => passingExerciseIds.has(id));
	}

	const history: HistorySnapshot = {
		earned,
		currentPassStreak,
		localesUsed,
		completesCourse
	};

	const enrichedSignal: AttemptSignal = {
		...input.attemptSignal,
		hintEventCount: input.attemptSignal.hintEventCount || countHintEvents(input.hintEventsJson)
	};

	const awards = evaluateBadges(enrichedSignal, history);
	if (awards.length === 0) return [];

	const now = Date.now();
	const updated: GuestProgressExport = {
		...progress,
		badges: [...earnedRows, ...awards.map((award) => ({ badgeKey: award.badge, awardedAt: now }))]
	};
	persist(updated);

	return awards.map((award) => award.badge);
}

export function getGuestBadges(): BadgeKey[] {
	const progress = readGuestProgress();
	return (progress.badges ?? []).map((row) => row.badgeKey);
}
