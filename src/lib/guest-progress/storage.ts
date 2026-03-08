import { browser } from '$app/environment';
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
	return {
		version: 1,
		clientId,
		exportedAt: Date.now(),
		courses: [],
		attempts: []
	};
}

function sanitizeProgress(value: unknown): GuestProgressExport {
	if (!value || typeof value !== 'object') {
		return createEmptyProgress();
	}

	const parsed = value as Partial<GuestProgressExport>;
	const clientId =
		typeof parsed.clientId === 'string' && parsed.clientId.trim().length > 0
			? parsed.clientId
			: createId();

	return {
		version: 1,
		clientId,
		exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
		courses: Array.isArray(parsed.courses) ? parsed.courses : [],
		attempts: Array.isArray(parsed.attempts) ? parsed.attempts : []
	};
}

function sortAttempts(attempts: GuestAttemptSnapshot[]): GuestAttemptSnapshot[] {
	return [...attempts].sort((left, right) => {
		if (left.createdAt !== right.createdAt) {
			return left.createdAt - right.createdAt;
		}
		return left.id.localeCompare(right.id);
	});
}

function recomputeCourseProgress(
	course: GuestCourseProgress,
	attempts: GuestAttemptSnapshot[]
): GuestCourseProgress {
	const exerciseProgress: GuestCourseProgress['exerciseProgress'] = {};

	for (const exerciseId of course.exerciseIds) {
		const exerciseAttempts = attempts.filter((attempt) => attempt.exerciseId === exerciseId);
		if (exerciseAttempts.length === 0) {
			continue;
		}

		const bestAttempt = exerciseAttempts.reduce((best, current) => {
			if (current.score > best.score) {
				return current;
			}
			if (current.score === best.score && current.createdAt > best.createdAt) {
				return current;
			}
			return best;
		});

		const lastAttempt = exerciseAttempts.reduce((latest, current) =>
			current.createdAt > latest.createdAt ? current : latest
		);

		exerciseProgress[exerciseId] = {
			exerciseId,
			bestScore: bestAttempt.score,
			passed: exerciseAttempts.some((attempt) => attempt.passed),
			attemptCount: exerciseAttempts.length,
			lastAttemptId: lastAttempt.id,
			lastAttemptAt: lastAttempt.createdAt
		};
	}

	const completedCount = Object.values(exerciseProgress).filter((progress) => progress.passed).length;
	const exerciseCount = course.exerciseIds.length;

	return {
		...course,
		exerciseProgress,
		completedCount,
		exerciseCount,
		progress: exerciseCount > 0 ? Math.round((completedCount / exerciseCount) * 100) : 0,
		updatedAt: Date.now()
	};
}

function persist(progress: GuestProgressExport): GuestProgressExport {
	const normalized = {
		...progress,
		exportedAt: Date.now(),
		courses: progress.courses.map((course) => recomputeCourseProgress(course, progress.attempts)),
		attempts: sortAttempts(progress.attempts)
	};

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
		return persist(sanitizeProgress(JSON.parse(raw)));
	} catch (error) {
		console.error('Failed to parse guest progress:', error);
		const fallback = createEmptyProgress();
		return persist(fallback);
	}
}

export function writeGuestProgress(progress: GuestProgressExport): GuestProgressExport {
	return persist(progress);
}

export function syncGuestCourseContext(courseId: string, exerciseIds: string[]): GuestProgressExport {
	const progress = readGuestProgress();
	const existingCourse = progress.courses.find((course) => course.courseId === courseId);

	if (existingCourse) {
		existingCourse.exerciseIds = Array.from(new Set([...existingCourse.exerciseIds, ...exerciseIds]));
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
	const mergedAttempts = new Map<string, GuestAttemptSnapshot>();

	for (const attempt of current.attempts) {
		mergedAttempts.set(attempt.id, attempt);
	}

	for (const attempt of incoming.attempts ?? []) {
		mergedAttempts.set(attempt.id, {
			...attempt,
			clientId: current.clientId,
			actorType: 'guest'
		});
	}

	const mergedCourses = new Map<string, GuestCourseProgress>();
	for (const course of current.courses) {
		mergedCourses.set(course.courseId, {
			...course,
			exerciseIds: [...course.exerciseIds]
		});
	}

	for (const course of incoming.courses ?? []) {
		const existing = mergedCourses.get(course.courseId);
		if (existing) {
			existing.exerciseIds = Array.from(new Set([...existing.exerciseIds, ...course.exerciseIds]));
			existing.lastExerciseId = course.lastExerciseId ?? existing.lastExerciseId;
			existing.lastExerciseIndex = course.lastExerciseIndex ?? existing.lastExerciseIndex;
			existing.updatedAt = Math.max(existing.updatedAt, course.updatedAt ?? Date.now());
		} else {
			mergedCourses.set(course.courseId, {
				...course,
				exerciseIds: [...course.exerciseIds]
			});
		}
	}

	return persist({
		version: 1,
		clientId: current.clientId,
		exportedAt: Date.now(),
		courses: [...mergedCourses.values()],
		attempts: [...mergedAttempts.values()]
	});
}

export function importGuestProgressJson(json: string): GuestProgressExport {
	const parsed = sanitizeProgress(JSON.parse(json));
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
