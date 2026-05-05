import type {
	GuestAttemptSnapshot,
	GuestBadgeRecord,
	GuestCourseProgress,
	GuestProgressExport
} from './types';

export function createEmptyGuestProgress(
	clientId: string,
	exportedAt = Date.now()
): GuestProgressExport {
	return {
		version: 1,
		clientId,
		exportedAt,
		courses: [],
		attempts: []
	};
}

export function sanitizeGuestProgress(
	value: unknown,
	createClientId: () => string,
	now = Date.now()
): GuestProgressExport {
	if (!value || typeof value !== 'object') {
		return createEmptyGuestProgress(createClientId(), now);
	}

	const parsed = value as Partial<GuestProgressExport>;
	const clientId =
		typeof parsed.clientId === 'string' && parsed.clientId.trim().length > 0
			? parsed.clientId
			: createClientId();

	return {
		version: 1,
		clientId,
		exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : now,
		courses: Array.isArray(parsed.courses) ? parsed.courses : [],
		attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
		badges: Array.isArray(parsed.badges) ? parsed.badges : []
	};
}

export function sortGuestAttempts(attempts: GuestAttemptSnapshot[]): GuestAttemptSnapshot[] {
	return [...attempts].sort((left, right) => {
		if (left.createdAt !== right.createdAt) {
			return left.createdAt - right.createdAt;
		}
		return left.id.localeCompare(right.id);
	});
}

export function recomputeGuestCourseProgress(
	course: GuestCourseProgress,
	attempts: GuestAttemptSnapshot[],
	now = Date.now()
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

	const completedCount = Object.values(exerciseProgress).filter(
		(progress) => progress.passed
	).length;
	const exerciseCount = course.exerciseIds.length;

	return {
		...course,
		exerciseProgress,
		completedCount,
		exerciseCount,
		progress: exerciseCount > 0 ? Math.round((completedCount / exerciseCount) * 100) : 0,
		updatedAt: now
	};
}

export function normalizeGuestProgress(
	progress: GuestProgressExport,
	now = Date.now()
): GuestProgressExport {
	return {
		...progress,
		exportedAt: now,
		courses: progress.courses.map((course) =>
			recomputeGuestCourseProgress(course, progress.attempts, now)
		),
		attempts: sortGuestAttempts(progress.attempts),
		badges: progress.badges ?? []
	};
}

export function mergeGuestProgressData(
	current: GuestProgressExport,
	incoming: GuestProgressExport,
	now = Date.now()
): GuestProgressExport {
	const mergedAttempts = new Map<string, GuestAttemptSnapshot>();

	for (const attempt of current.attempts) {
		mergedAttempts.set(attempt.id, {
			...attempt,
			clientId: current.clientId,
			actorType: 'guest'
		});
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
			existing.updatedAt = Math.max(existing.updatedAt, course.updatedAt ?? now);
		} else {
			mergedCourses.set(course.courseId, {
				...course,
				exerciseIds: [...course.exerciseIds]
			});
		}
	}

	const mergedBadges = new Map<string, GuestBadgeRecord>();
	for (const badge of current.badges ?? []) {
		mergedBadges.set(badge.badgeKey, badge);
	}
	for (const badge of incoming.badges ?? []) {
		const existing = mergedBadges.get(badge.badgeKey);
		if (!existing || badge.awardedAt < existing.awardedAt) {
			mergedBadges.set(badge.badgeKey, badge);
		}
	}

	return normalizeGuestProgress(
		{
			version: 1,
			clientId: current.clientId,
			exportedAt: now,
			courses: [...mergedCourses.values()],
			attempts: [...mergedAttempts.values()],
			badges: [...mergedBadges.values()]
		},
		now
	);
}
