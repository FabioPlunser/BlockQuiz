import { browser } from '$app/environment';
import {
	createEmptyGuestProgress,
	mergeGuestProgressData,
	normalizeGuestProgress,
	sanitizeGuestProgress
} from '$lib/guest-progress/merge';
import type {
	GuestAttemptDraft,
	GuestAttemptSnapshot,
	GuestCourseProgress,
	GuestProgressExport
} from '$lib/guest-progress/types';

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

export function mergeGuestProgress(incoming: GuestProgressExport): GuestProgressExport {
	const current = readGuestProgress();
	return persist(mergeGuestProgressData(current, incoming));
}

export function importGuestProgressJson(json: string): GuestProgressExport {
	const parsed = sanitizeGuestProgress(JSON.parse(json), createId);
	return mergeGuestProgress(parsed);
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

export function exportGuestProgress(): string {
	return JSON.stringify(readGuestProgress(), null, 2);
}

export function hasGuestProgress(): boolean {
	const progress = readGuestProgress();
	return progress.attempts.length > 0 || progress.courses.length > 0;
}
