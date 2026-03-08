import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, command } from '$app/server';
import { db } from '$lib/server/db/client';
import { courses, courseExercises, courseUsers, exercises, attempts } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, requireTeacherOrAdmin } from '$lib/utils/requireAuth';
import { canonicalizeExercise, type Exercise } from '$lib/types/exercise';
import type { AttemptLocale } from '$lib/types/attempt';

// =============================================================================
// Zod Schemas
// =============================================================================
const localizedStringSchema = z.object({
	de: z.string(),
	en: z.string()
});

const contentSchema = z.object({
	title: localizedStringSchema,
	description: localizedStringSchema,
	image: z.string()
});

const createCourseSchema = z.object({
	content: contentSchema,
	published: z.boolean().optional().default(false),
	exerciseIds: z.array(z.string()).optional().default([]),
	userIds: z.array(z.string()).optional().default([])
});

const updateCourseSchema = createCourseSchema.extend({
	id: z.string()
});

const guestAttemptImportSchema = z.object({
	id: z.string(),
	exerciseId: z.string(),
	clientId: z.string(),
	actorType: z.literal('guest'),
	workspaceXml: z.string().optional().default(''),
	generatedCode: z.string().optional().default(''),
	resultJson: z.string(),
	locale: z.enum(['de', 'en']).default('de'),
	startedAt: z.number(),
	endedAt: z.number(),
	score: z.number().min(0).max(100),
	passed: z.boolean(),
	hintEventsJson: z.string().optional().default('[]'),
	analyticsJson: z.string().optional().default('{}'),
	createdAt: z.number()
});

async function mapCoursesWithRelations(
	courseRows: Array<typeof courses.$inferSelect>,
	options: { includeUsers?: boolean; publishedExercisesOnly?: boolean } = {}
) {
	const allCourseExercises = await db.select().from(courseExercises);
	const allExercises = await db.select().from(exercises);
	const exerciseIdFilter = new Set(
		allExercises
			.filter((exercise) => !options.publishedExercisesOnly || exercise.published)
			.map((exercise) => exercise.id)
	);

	const allCourseUsers = options.includeUsers ? await db.select().from(courseUsers) : [];

	return courseRows.map((course) => ({
		...course,
		exerciseIds: allCourseExercises
			.filter((relation) => relation.courseId === course.id && exerciseIdFilter.has(relation.exerciseId))
			.sort((left, right) => left.order - right.order)
			.map((relation) => relation.exerciseId),
		userIds: options.includeUsers
			? allCourseUsers.filter((relation) => relation.courseId === course.id).map((relation) => relation.userId)
			: []
	}));
}

async function loadPublishedCourseExercises(courseId: string): Promise<Exercise[]> {
	const courseExerciseRelations = await db
		.select()
		.from(courseExercises)
		.where(eq(courseExercises.courseId, courseId))
		.orderBy(courseExercises.order);

	if (courseExerciseRelations.length === 0) {
		return [];
	}

	const courseExerciseList: Exercise[] = [];
	for (const relation of courseExerciseRelations) {
		const [exercise] = await db
			.select()
			.from(exercises)
			.where(and(eq(exercises.id, relation.exerciseId), eq(exercises.published, true)))
			.limit(1);
		if (exercise) {
			courseExerciseList.push(
				canonicalizeExercise({
					...exercise,
					content: exercise.content,
					config: exercise.config,
					validationJson: exercise.validationJson,
					image: exercise.image
				})
			);
		}
	}

	return courseExerciseList;
}

// =============================================================================
// Query Functions
// =============================================================================

export const getCourses = query('unchecked', async () => {
	requireTeacherOrAdmin();

	return mapCoursesWithRelations(await db.select().from(courses), { includeUsers: true });
});

export const getCourse = query(z.object({ id: z.string() }), async ({ id }) => {
	requireTeacherOrAdmin();

	const result = await db.select().from(courses).where(eq(courses.id, id));

	if (result.length === 0) {
		error(404, 'Course not found');
	}

	const course = result[0];

	// Get exercise IDs for this course
	const exerciseRelations = await db
		.select()
		.from(courseExercises)
		.where(eq(courseExercises.courseId, id));

	// Get user IDs for this course
	const userRelations = await db.select().from(courseUsers).where(eq(courseUsers.courseId, id));

	return {
		...course,
		exerciseIds: exerciseRelations.map((r) => r.exerciseId),
		userIds: userRelations.map((r) => r.userId)
	};
});

/**
 * Get courses assigned to the current user (for students).
 * Only returns published courses.
 */
export const getUserCourses = query('unchecked', async () => {
	const user = requireAuth();

	// Get course IDs assigned to this user
	const userCourseRelations = await db
		.select()
		.from(courseUsers)
		.where(eq(courseUsers.userId, user.id));

	const userCourseIds = userCourseRelations.map((r) => r.courseId);

	if (userCourseIds.length === 0) {
		return [];
	}

	const userCourses = (await db.select().from(courses)).filter(
		(course) => userCourseIds.includes(course.id) && course.published
	);

	return mapCoursesWithRelations(userCourses, { publishedExercisesOnly: true });
});

export const getPublicCourses = query('unchecked', async () => {
	const publicCourses = (await db.select().from(courses)).filter((course) => course.published);
	return mapCoursesWithRelations(publicCourses, { publishedExercisesOnly: true });
});

// =============================================================================
// Player API Functions
// =============================================================================

/**
 * Get all exercises for a course (for students playing the course).
 * Only returns published exercises, ordered by their order field.
 */
export const getCourseExercises = query(z.string(), async (courseId) => {
	const user = requireAuth();

	// Verify user has access to this course
	const userCourseAccess = await db
		.select()
		.from(courseUsers)
		.where(and(eq(courseUsers.courseId, courseId), eq(courseUsers.userId, user.id)));

	if (userCourseAccess.length === 0) {
		error(403, 'You do not have access to this course');
	}

	// Get the course to verify it's published
	const course = await db.select().from(courses).where(eq(courses.id, courseId));
	if (course.length === 0) {
		error(404, 'Course not found');
	}
	if (!course[0].published) {
		error(403, 'This course is not published');
	}

	return loadPublishedCourseExercises(courseId);
});

export const getPublicCourseExercises = query(z.string(), async (courseId) => {
	const [course] = await db
		.select()
		.from(courses)
		.where(and(eq(courses.id, courseId), eq(courses.published, true)))
		.limit(1);

	if (!course) {
		error(404, 'Course not found');
	}

	return loadPublishedCourseExercises(courseId);
});

/**
 * Submit an attempt for an exercise.
 */
export const submitAttempt = command(
	z.object({
		exerciseId: z.string(),
		workspaceXml: z.string().optional().default(''),
		generatedCode: z.string().optional().default(''),
		resultJson: z.string(),
		score: z.number().min(0).max(100),
		passed: z.boolean(),
		startedAt: z.number(),
		endedAt: z.number().optional(),
		locale: z.enum(['de', 'en']).optional().default('de'),
		hintEventsJson: z.string().optional().default('[]'),
		analyticsJson: z.string().optional().default('{}')
	}),
	async (data) => {
		const user = requireAuth();

		const id = crypto.randomUUID();
		const endedAt = data.endedAt ?? Date.now();

		await db.insert(attempts).values({
			id,
			exerciseId: data.exerciseId,
			userId: user.id,
			clientId: null,
			actorType: 'user',
			workspaceXml: data.workspaceXml,
			generatedCode: data.generatedCode,
			resultJson: data.resultJson,
			score: data.score,
			passed: data.passed,
			startedAt: data.startedAt,
			endedAt,
			locale: data.locale,
			hintEventsJson: data.hintEventsJson,
			analyticsJson: data.analyticsJson,
			createdAt: endedAt
		});

		return { id, success: true };
	}
);

export const importGuestAttempts = command(
	z.object({
		attempts: z.array(guestAttemptImportSchema)
	}),
	async ({ attempts: guestAttempts }) => {
		const user = requireAuth();

		if (guestAttempts.length === 0) {
			return {
				success: true as const,
				importedCount: 0
			};
		}

		const existingAttemptIds = new Set(
			(
				await db
					.select({ id: attempts.id })
					.from(attempts)
					.where(eq(attempts.userId, user.id))
			).map((attempt) => attempt.id)
		);

		const values = guestAttempts
			.filter((attempt) => !existingAttemptIds.has(attempt.id))
			.map((attempt) => ({
				id: attempt.id,
				exerciseId: attempt.exerciseId,
				userId: user.id,
				clientId: null,
				actorType: 'user' as const,
				workspaceXml: attempt.workspaceXml,
				generatedCode: attempt.generatedCode,
				resultJson: attempt.resultJson,
				score: attempt.score,
				passed: attempt.passed,
				startedAt: attempt.startedAt,
				endedAt: attempt.endedAt,
				locale: attempt.locale as AttemptLocale,
				hintEventsJson: attempt.hintEventsJson,
				analyticsJson: attempt.analyticsJson,
				createdAt: attempt.createdAt
			}));

		if (values.length === 0) {
			return {
				success: true as const,
				importedCount: 0
			};
		}

		await db.insert(attempts).values(values);

		return {
			success: true as const,
			importedCount: values.length
		};
	}
);

/**
 * Get user's progress for a course.
 * Returns the best attempt for each exercise and overall course progress.
 */
export const getCourseProgress = query(z.object({ courseId: z.string() }), async ({ courseId }) => {
	const user = requireAuth();

	// Get exercise IDs for this course
	const courseExerciseRelations = await db
		.select()
		.from(courseExercises)
		.where(eq(courseExercises.courseId, courseId))
		.orderBy(courseExercises.order);

	const exerciseIds = courseExerciseRelations.map((r) => r.exerciseId);

	if (exerciseIds.length === 0) {
		return {
			exerciseCount: 0,
			completedCount: 0,
			progress: 0,
			exerciseProgress: {}
		};
	}

	// Get all attempts by this user for exercises in this course
	const userAttempts = await db
		.select()
		.from(attempts)
		.where(eq(attempts.userId, user.id))
		.orderBy(desc(attempts.createdAt));

	// Build progress map - best attempt per exercise
	const exerciseProgress: Record<
		string,
		{ passed: boolean; bestScore: number; attemptCount: number }
	> = {};

	for (const exerciseId of exerciseIds) {
		const exerciseAttempts = userAttempts.filter((a) => a.exerciseId === exerciseId);
		if (exerciseAttempts.length > 0) {
			const bestScore = Math.max(...exerciseAttempts.map((a) => a.score));
			const hasPassed = exerciseAttempts.some((a) => a.passed);
			exerciseProgress[exerciseId] = {
				passed: hasPassed,
				bestScore,
				attemptCount: exerciseAttempts.length
			};
		}
	}

	const completedCount = Object.values(exerciseProgress).filter((p) => p.passed).length;

	return {
		exerciseCount: exerciseIds.length,
		completedCount,
		progress: exerciseIds.length > 0 ? (completedCount / exerciseIds.length) * 100 : 0,
		exerciseProgress
	};
});

// =============================================================================
// Command Functions
// =============================================================================

export const createCourse = command(createCourseSchema, async (data) => {
	const user = requireTeacherOrAdmin();
	const { content, published, exerciseIds, userIds } = data;

	const id = crypto.randomUUID();
	const now = Date.now();

	try {
		// Insert course
		await db.insert(courses).values({
			id,
			content,
			published: published ?? false,
			createdAt: now,
			updatedAt: new Date(now),
			createdBy: user.email ?? ''
		});

		// Insert course-exercise relationships
		if (exerciseIds && exerciseIds.length > 0) {
			await db.insert(courseExercises).values(
				exerciseIds.map((exerciseId, index) => ({
					id: crypto.randomUUID(),
					courseId: id,
					exerciseId,
					order: index,
					createdAt: now,
					updatedAt: now
				}))
			);
		}

		// Insert course-user relationships
		if (userIds && userIds.length > 0) {
			await db.insert(courseUsers).values(
				userIds.map((userId) => ({
					id: crypto.randomUUID(),
					courseId: id,
					userId,
					createdAt: now,
					updatedAt: now
				}))
			);
		}

		return {
			success: true as const,
			id
		};
	} catch (e) {
		console.error('Error creating course:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to create course'
		};
	}
});

export const updateCourse = command(updateCourseSchema, async (data) => {
	requireTeacherOrAdmin();
	const { id, content, published, exerciseIds, userIds } = data;

	const now = Date.now();

	try {
		// Check if course exists
		const existing = await db.select().from(courses).where(eq(courses.id, id));
		if (existing.length === 0) {
			return {
				success: false as const,
				error: 'Course not found'
			};
		}

		// Update course
		await db
			.update(courses)
			.set({
				content,
				published: published ?? false,
				updatedAt: new Date(now)
			})
			.where(eq(courses.id, id));

		// Delete existing course-exercise relationships
		await db.delete(courseExercises).where(eq(courseExercises.courseId, id));

		// Insert new course-exercise relationships
		if (exerciseIds && exerciseIds.length > 0) {
			await db.insert(courseExercises).values(
				exerciseIds.map((exerciseId, index) => ({
					id: crypto.randomUUID(),
					courseId: id,
					exerciseId,
					order: index,
					createdAt: now,
					updatedAt: now
				}))
			);
		}

		// Delete existing course-user relationships
		await db.delete(courseUsers).where(eq(courseUsers.courseId, id));

		// Insert new course-user relationships
		if (userIds && userIds.length > 0) {
			await db.insert(courseUsers).values(
				userIds.map((userId) => ({
					id: crypto.randomUUID(),
					courseId: id,
					userId,
					createdAt: now,
					updatedAt: now
				}))
			);
		}

		return {
			success: true as const,
			id
		};
	} catch (e) {
		console.error('Error updating course:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to update course'
		};
	}
});

export const deleteCourse = command(z.string(), async (id) => {
	requireTeacherOrAdmin();

	try {
		const existing = await db.select().from(courses).where(eq(courses.id, id));
		if (existing.length === 0) {
			return {
				success: false as const,
				error: 'Course not found'
			};
		}

		// Delete the course (cascade will delete related courseExercises and courseUsers)
		await db.delete(courses).where(eq(courses.id, id));

		return {
			success: true as const
		};
	} catch (e) {
		console.error('Error deleting course:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to delete course'
		};
	}
});
