import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import {
	courseClasses,
	courseExercises,
	courseUsers,
	courses,
	exercises
} from '$lib/server/db/schema';
import {
	formatCoursePublishValidationError,
	validateCoursePublishReadiness
} from '$lib/courses/validation';
import type { CourseContent } from '$lib/types/course';
import {
	canonicalizeExercise,
	stripExerciseForLearners,
	type Exercise
} from '$lib/types/exercise';
import type { AttemptAnalytics, HintRevealEvent } from '$lib/types/attempt';
import { attemptAnalyticsSchema, hintRevealEventSchema } from './schemas';

// =============================================================================
// JSON sanitizers — clamp untrusted input to known shapes
// =============================================================================

export function sanitizeHintEventsJson(value: string) {
	try {
		const parsed = z.array(hintRevealEventSchema).parse(JSON.parse(value));
		return JSON.stringify(parsed satisfies HintRevealEvent[]);
	} catch {
		return '[]';
	}
}

export function sanitizeAnalyticsJson(value: string, defaults: AttemptAnalytics) {
	try {
		const parsed = attemptAnalyticsSchema.parse({ ...defaults, ...JSON.parse(value) });
		return { raw: JSON.stringify(parsed), parsed };
	} catch {
		return { raw: JSON.stringify(defaults), parsed: defaults };
	}
}

export function countHintEvents(value: string) {
	try {
		return z.array(hintRevealEventSchema).parse(JSON.parse(value)).length;
	} catch {
		return 0;
	}
}

export function parseAttemptAnalytics(
	value: string,
	exerciseType: Exercise['type']
): AttemptAnalytics {
	return sanitizeAnalyticsJson(value, {
		exerciseType,
		totalTests: 0,
		passedTests: 0,
		hintUsageCount: 0,
		submittedAt: Date.now()
	}).parsed;
}

// =============================================================================
// Course relation projections
// =============================================================================

/**
 * Project base course rows into the staff-view shape — adds the exercise and
 * user relation arrays. Loads every relation table in one pass to avoid
 * N+1 queries when called for a list of courses.
 */
export async function mapCoursesWithRelations(
	courseRows: Array<typeof courses.$inferSelect>,
	options: { includeUsers?: boolean; publishedExercisesOnly?: boolean } = {}
) {
	const allCourseExercises = await db.select().from(courseExercises);
	const allExercises = await db.select().from(exercises);
	const exerciseIdFilter = new Set(
		allExercises
			.filter(
				(exercise) =>
					exercise.archivedAt == null && (!options.publishedExercisesOnly || exercise.published)
			)
			.map((exercise) => exercise.id)
	);

	const allCourseUsers = options.includeUsers ? await db.select().from(courseUsers) : [];
	const allCourseClasses = options.includeUsers ? await db.select().from(courseClasses) : [];

	return courseRows.map((course) => ({
		...course,
		exerciseIds: allCourseExercises
			.filter(
				(relation) => relation.courseId === course.id && exerciseIdFilter.has(relation.exerciseId)
			)
			.sort((l, r) => l.order - r.order)
			.map((relation) => relation.exerciseId),
		userIds: options.includeUsers
			? allCourseUsers
					.filter((relation) => relation.courseId === course.id)
					.map((relation) => relation.userId)
			: [],
		classIds: options.includeUsers
			? allCourseClasses
					.filter((relation) => relation.courseId === course.id)
					.map((relation) => relation.classId)
			: []
	}));
}

/** Published, non-archived exercises for a course, learner-safe (hidden tests stripped). */
export async function loadPublishedCourseExercises(courseId: string): Promise<Exercise[]> {
	const relations = await db
		.select()
		.from(courseExercises)
		.where(eq(courseExercises.courseId, courseId))
		.orderBy(courseExercises.order);

	if (relations.length === 0) return [];

	const out: Exercise[] = [];
	for (const relation of relations) {
		const [exercise] = await db
			.select()
			.from(exercises)
			.where(and(eq(exercises.id, relation.exerciseId), eq(exercises.published, true)))
			.limit(1);
		if (exercise && exercise.archivedAt == null) {
			out.push(
				stripExerciseForLearners(
					canonicalizeExercise({
						...exercise,
						content: exercise.content,
						config: exercise.config,
						validationJson: exercise.validationJson,
						image: exercise.image
					})
				)
			);
		}
	}
	return out;
}

/**
 * Load a minimal projection of exercises by id — only the fields the
 * publish-readiness validator needs. Used by the staff-side validator.
 */
export async function loadCoursePublishExercises(exerciseIds: string[]) {
	if (exerciseIds.length === 0) return [];
	const exerciseIdSet = new Set(exerciseIds);
	const rows = (await db.select().from(exercises)).filter((row) => exerciseIdSet.has(row.id));
	return rows.map((row) => {
		const exercise = canonicalizeExercise({
			...row,
			content: row.content,
			config: row.config,
			validationJson: row.validationJson,
			image: row.image
		});
		return {
			id: exercise.id,
			published: exercise.published,
			archivedAt: exercise.archivedAt,
			validation: exercise.validation
		};
	});
}

/**
 * Returns a formatted error message when the course-publish-readiness check
 * fails, or `null` when the course is ready to publish.
 */
export async function validatePublishedCourseInput(
	content: CourseContent,
	exerciseIds: string[]
) {
	const validation = validateCoursePublishReadiness({
		content,
		exerciseIds,
		exercises: await loadCoursePublishExercises(exerciseIds)
	});
	if (!validation.valid) return formatCoursePublishValidationError(validation);
	return null;
}
