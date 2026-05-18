import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import {
	achievements,
	attempts,
	courseClasses,
	courseExercises,
	courseUsers,
	courses,
	exercises
} from '$lib/server/db/schema';
import { computeCourseAnalytics } from '$lib/analytics/course-analytics';
import { createCourseResearchExport } from '$lib/analytics/research-export';
import {
	canonicalizeExercise,
	type Exercise
} from '$lib/types/exercise';
import {
	countHintEvents,
	loadPublishedCourseExercises,
	mapCoursesWithRelations,
	parseAttemptAnalytics
} from './helpers';
import { getEnrolledCourseIds, isEnrolledInCourse } from '$lib/server/enrolment';

// =============================================================================
// Course listing & access
// =============================================================================

/** Staff: every course, with exercise and user relation arrays. */
export async function loadStaffCourses() {
	return mapCoursesWithRelations(await db.select().from(courses), { includeUsers: true });
}

/** Anonymous: only published, non-archived courses; staff-irrelevant fields trimmed. */
export async function loadPublicCourses() {
	const publicCourses = (await db.select().from(courses)).filter(
		(course) => course.published && course.archivedAt == null
	);
	return mapCoursesWithRelations(publicCourses, { publishedExercisesOnly: true });
}

/** A single course row (no relations) or null if not found. */
export async function loadCourseRow(id: string) {
	const [row] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
	return row ?? null;
}

/** Staff projection — adds exerciseIds + userIds + classIds to a base course row. */
export async function loadCourseWithRelations(course: typeof courses.$inferSelect) {
	const exerciseRelations = await db
		.select()
		.from(courseExercises)
		.where(eq(courseExercises.courseId, course.id));
	const userRelations = await db
		.select()
		.from(courseUsers)
		.where(eq(courseUsers.courseId, course.id));
	const classRelations = await db
		.select()
		.from(courseClasses)
		.where(eq(courseClasses.courseId, course.id));
	return {
		...course,
		exerciseIds: exerciseRelations.sort((a, b) => a.order - b.order).map((r) => r.exerciseId),
		userIds: userRelations.map((r) => r.userId),
		classIds: classRelations.map((r) => r.classId)
	};
}

/**
 * Courses a user is assigned to, with per-course progress. Enrolment is the
 * UNION of direct courseUsers and (classUsers ⋈ courseClasses), deduped.
 * Three grouped queries — one to find enrolled course ids, one for exercise
 * counts, one for the user's pass counts — then assembled in JS.
 */
export async function listAssignedCoursesForUser(userId: string) {
	const enrolledIds = await getEnrolledCourseIds(userId);
	if (enrolledIds.size === 0) return [];

	const assignedCourses = await db
		.select({
			courseId: courses.id,
			content: courses.content,
			published: courses.published,
			createdAt: courses.createdAt,
			updatedAt: courses.updatedAt,
			archivedAt: courses.archivedAt,
			archivedBy: courses.archivedBy
		})
		.from(courses)
		.where(
			and(
				inArray(courses.id, [...enrolledIds]),
				eq(courses.published, true),
				isNull(courses.archivedAt)
			)
		);

	if (assignedCourses.length === 0) return [];

	const courseIds = assignedCourses.map((c) => c.courseId);

	const exerciseCounts = await db
		.select({
			courseId: courseExercises.courseId,
			total: sql<number>`count(*)`.as('total')
		})
		.from(courseExercises)
		.innerJoin(exercises, eq(exercises.id, courseExercises.exerciseId))
		.where(
			and(
				inArray(courseExercises.courseId, courseIds),
				eq(exercises.published, true),
				isNull(exercises.archivedAt)
			)
		)
		.groupBy(courseExercises.courseId);

	const passedCounts = await db
		.select({
			courseId: courseExercises.courseId,
			passed: sql<number>`count(distinct ${courseExercises.exerciseId})`.as('passed')
		})
		.from(courseExercises)
		.innerJoin(
			attempts,
			and(eq(attempts.exerciseId, courseExercises.exerciseId), eq(attempts.passed, true))
		)
		.where(and(inArray(courseExercises.courseId, courseIds), eq(attempts.userId, userId)))
		.groupBy(courseExercises.courseId);

	const totalByCourse = new Map(exerciseCounts.map((r) => [r.courseId, r.total]));
	const passedByCourse = new Map(passedCounts.map((r) => [r.courseId, r.passed]));

	return assignedCourses.map((course) => {
		const numExercises = totalByCourse.get(course.courseId) ?? 0;
		const completedCount = passedByCourse.get(course.courseId) ?? 0;
		return {
			id: course.courseId,
			content: course.content,
			createdAt: course.createdAt,
			updatedAt: course.updatedAt,
			published: course.published,
			numExercises,
			completedCount,
			progress: numExercises > 0 ? (completedCount / numExercises) * 100 : 0
		};
	});
}

/** Member-only: the published exercises for a course the user is enrolled in. */
export async function loadCourseExercisesForMember(userId: string, courseId: string) {
	if (!(await isEnrolledInCourse(userId, courseId))) {
		return { reason: 'not-member' as const };
	}

	const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
	if (!course) return { reason: 'not-found' as const };
	if (!course.published || course.archivedAt != null) {
		return { reason: 'not-published' as const };
	}

	return { reason: 'ok' as const, exercises: await loadPublishedCourseExercises(courseId) };
}

/** Public path: published exercises for any published course, no auth required. */
export async function loadPublicCourseExercises(courseId: string) {
	const [course] = await db
		.select()
		.from(courses)
		.where(and(eq(courses.id, courseId), eq(courses.published, true)))
		.limit(1);
	if (!course || course.archivedAt != null) return { reason: 'not-found' as const };
	return { reason: 'ok' as const, exercises: await loadPublishedCourseExercises(courseId) };
}

// =============================================================================
// Badges & progress
// =============================================================================

export async function loadEarnedBadges(userId: string) {
	return db
		.select({ badgeKey: achievements.badgeKey, awardedAt: achievements.awardedAt })
		.from(achievements)
		.where(eq(achievements.userId, userId))
		.orderBy(desc(achievements.awardedAt));
}

export type CourseProgress = {
	exerciseCount: number;
	completedCount: number;
	progress: number;
	exerciseProgress: Record<
		string,
		{ passed: boolean; bestScore: number; attemptCount: number }
	>;
	latestSnapshots: Record<string, { workspaceXml: string; resultJson: string }>;
};

export async function loadCourseProgress(
	userId: string,
	courseId: string
): Promise<CourseProgress> {
	const relations = await db
		.select()
		.from(courseExercises)
		.where(eq(courseExercises.courseId, courseId))
		.orderBy(courseExercises.order);

	const exerciseIds = relations.map((r) => r.exerciseId);
	if (exerciseIds.length === 0) {
		return {
			exerciseCount: 0,
			completedCount: 0,
			progress: 0,
			exerciseProgress: {},
			latestSnapshots: {}
		};
	}

	const userAttempts = await db
		.select()
		.from(attempts)
		.where(eq(attempts.userId, userId))
		.orderBy(desc(attempts.createdAt));

	const exerciseProgress: CourseProgress['exerciseProgress'] = {};
	const latestSnapshots: CourseProgress['latestSnapshots'] = {};

	for (const exerciseId of exerciseIds) {
		const rows = userAttempts.filter((a) => a.exerciseId === exerciseId);
		if (rows.length === 0) continue;
		exerciseProgress[exerciseId] = {
			passed: rows.some((a) => a.passed),
			bestScore: Math.max(...rows.map((a) => a.score)),
			attemptCount: rows.length
		};
		latestSnapshots[exerciseId] = {
			workspaceXml: rows[0].workspaceXml,
			resultJson: rows[0].resultJson
		};
	}

	const completedCount = Object.values(exerciseProgress).filter((p) => p.passed).length;
	return {
		exerciseCount: exerciseIds.length,
		completedCount,
		progress: exerciseIds.length > 0 ? (completedCount / exerciseIds.length) * 100 : 0,
		exerciseProgress,
		latestSnapshots
	};
}

// =============================================================================
// Analytics & exports
// =============================================================================

export async function loadCourseAnalytics(courseId: string) {
	const relations = await db
		.select()
		.from(courseExercises)
		.where(eq(courseExercises.courseId, courseId))
		.orderBy(courseExercises.order);

	const exerciseIds = relations.map((r) => r.exerciseId);
	const [exerciseRows, attemptRows] = await Promise.all([
		db.select().from(exercises),
		db.select().from(attempts)
	]);

	return computeCourseAnalytics({
		exerciseIds,
		exerciseRows,
		attemptRows,
		countHintEvents,
		parseAttemptAnalytics
	});
}

export async function loadCourseAttemptsExport(courseId: string) {
	const relations = await db
		.select()
		.from(courseExercises)
		.where(eq(courseExercises.courseId, courseId))
		.orderBy(courseExercises.order);

	const exerciseIds = new Set(relations.map((r) => r.exerciseId));
	const exerciseRows = await db.select().from(exercises);
	const exerciseMap = new Map(exerciseRows.map((e) => [e.id, e]));
	const allAttempts = await db.select().from(attempts).orderBy(desc(attempts.createdAt));

	const rows = allAttempts
		.filter((a) => exerciseIds.has(a.exerciseId))
		.map((a) => {
			const ex = exerciseMap.get(a.exerciseId);
			const title =
				ex?.content &&
				typeof ex.content === 'object' &&
				'title' in (ex.content as Record<string, unknown>)
					? ((ex.content as Record<string, unknown>).title as { de: string; en: string })
					: { de: a.exerciseId, en: a.exerciseId };
			return {
				attemptId: a.id,
				exerciseId: a.exerciseId,
				exerciseTitle: title.en || title.de,
				exerciseType: ex?.type ?? '',
				userId: a.userId ?? '',
				actorType: a.actorType,
				score: a.score,
				passed: a.passed,
				startedAt: a.startedAt,
				endedAt: a.endedAt,
				durationMs: Math.max(0, a.endedAt - a.startedAt),
				hintUsageCount: countHintEvents(a.hintEventsJson),
				analytics: parseAttemptAnalytics(a.analyticsJson, (ex?.type ?? 'io') as Exercise['type']),
				locale: a.locale,
				createdAt: a.createdAt
			};
		});

	return { rows };
}

export async function loadCourseResearchExport(courseId: string) {
	const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
	if (!course) return null;

	const relations = await db
		.select()
		.from(courseExercises)
		.where(eq(courseExercises.courseId, courseId))
		.orderBy(courseExercises.order);

	const exerciseIds = new Set(relations.map((r) => r.exerciseId));
	const exerciseRows = (await db.select().from(exercises)).filter((e) => exerciseIds.has(e.id));
	const courseAttempts = (
		await db.select().from(attempts).orderBy(desc(attempts.createdAt))
	).filter((a) => exerciseIds.has(a.exerciseId));

	return createCourseResearchExport({
		course: { id: course.id, content: course.content },
		exercises: exerciseRows.map((e) => ({ id: e.id, type: e.type, content: e.content })),
		attempts: courseAttempts
	});
}

/** Hydrated exercises for the export-bundle helper. */
export async function loadCourseExercisesForExport(courseId: string) {
	const relations = await db
		.select()
		.from(courseExercises)
		.where(eq(courseExercises.courseId, courseId))
		.orderBy(courseExercises.order);

	const rows = await Promise.all(
		relations.map(async (relation) => {
			const [exercise] = await db
				.select()
				.from(exercises)
				.where(eq(exercises.id, relation.exerciseId))
				.limit(1);
			if (!exercise) return null;
			const hydrated = canonicalizeExercise({
				...exercise,
				content: exercise.content,
				config: exercise.config,
				validationJson: exercise.validationJson,
				image: exercise.image
			});
			return {
				id: hydrated.id,
				type: hydrated.type,
				content: hydrated.content,
				config: hydrated.config,
				published: hydrated.published,
				order: relation.order
			};
		})
	);

	return rows.filter((r): r is NonNullable<typeof r> => Boolean(r));
}
