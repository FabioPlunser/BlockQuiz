import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, command } from '$app/server';
import { db } from '$lib/server/db/client';
import { courses, courseExercises, courseUsers, exercises, attempts } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, requireTeacherOrAdmin } from '$lib/utils/requireAuth';
import type { Exercise } from '$lib/types/exercise';

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

// =============================================================================
// Query Functions
// =============================================================================

export const getCourses = query('unchecked', async () => {
	requireTeacherOrAdmin();

	// Get all courses
	const _courses = await db.select().from(courses);

	// Get all course-exercise relationships
	const allCourseExercises = await db.select().from(courseExercises);

	// Get all course-user relationships
	const allCourseUsers = await db.select().from(courseUsers);

	// Map courses with their exercise and user IDs
	return _courses.map((course) => ({
		...course,
		exerciseIds: allCourseExercises
			.filter((ce) => ce.courseId === course.id)
			.map((ce) => ce.exerciseId),
		userIds: allCourseUsers.filter((cu) => cu.courseId === course.id).map((cu) => cu.userId)
	}));
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

	// Get all courses
	const allCourses = await db.select().from(courses);

	// Filter to only published courses assigned to user
	const userCourses = allCourses.filter(
		(course) => userCourseIds.includes(course.id) && course.published
	);

	// Get all course-exercise relationships for these courses
	const allCourseExercises = await db.select().from(courseExercises);

	// Map courses with their exercise IDs
	return userCourses.map((course) => ({
		...course,
		exerciseIds: allCourseExercises
			.filter((ce) => ce.courseId === course.id)
			.map((ce) => ce.exerciseId)
	}));
});

// =============================================================================
// Player API Functions
// =============================================================================

/**
 * Get all exercises for a course (for students playing the course).
 * Only returns published exercises, ordered by their order field.
 */
export const getCourseExercises = query(
	z.object({ courseId: z.string() }),
	async ({ courseId }) => {
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

		// Get exercise IDs for this course in order
		const courseExerciseRelations = await db
			.select()
			.from(courseExercises)
			.where(eq(courseExercises.courseId, courseId))
			.orderBy(courseExercises.order);

		if (courseExerciseRelations.length === 0) {
			return [];
		}

		// Get the actual exercises
		const exerciseIds = courseExerciseRelations.map((r) => r.exerciseId);
		const allExercises = await db.select().from(exercises);

		// Filter and order exercises according to course order
		const courseExercisesList = exerciseIds
			.map((id) => allExercises.find((e) => e.id === id))
			.filter((e): e is typeof allExercises[0] => e !== undefined && e.published);

		return courseExercisesList as Exercise[];
	}
);

/**
 * Submit an attempt for an exercise.
 */
export const submitAttempt = command(
	z.object({
		exerciseId: z.string(),
		resultJson: z.string(),
		score: z.number().min(0).max(100),
		passed: z.boolean(),
		startedAt: z.number(),
		locale: z.enum(['de', 'en']).optional().default('de')
	}),
	async (data) => {
		const user = requireAuth();

		const id = crypto.randomUUID();
		const now = Date.now();

		await db.insert(attempts).values({
			id,
			exerciseId: data.exerciseId,
			userId: user.id,
			resultJson: data.resultJson,
			score: data.score,
			passed: data.passed,
			startedAt: data.startedAt,
			endedAt: now,
			locale: data.locale,
			createdAt: now
		});

		return { id, success: true };
	}
);

/**
 * Get user's progress for a course.
 * Returns the best attempt for each exercise and overall course progress.
 */
export const getCourseProgress = query(
	z.object({ courseId: z.string() }),
	async ({ courseId }) => {
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
				const bestScore = Math.max(...exerciseAttempts.map((a) => a.score ?? 0));
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
	}
);

// =============================================================================
// Command Functions
// =============================================================================

export const createCourse = command(createCourseSchema, async (data) => {
	const user = requireTeacherOrAdmin();
	const { content, published, exerciseIds, userIds } = data;

	const id = crypto.randomUUID();
	const now = Date.now();

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
		success: true,
		id
	};
});

export const updateCourse = command(updateCourseSchema, async (data) => {
	requireTeacherOrAdmin();
	const { id, content, published, exerciseIds, userIds } = data;

	const now = Date.now();

	// Check if course exists
	const existing = await db.select().from(courses).where(eq(courses.id, id));
	if (existing.length === 0) {
		error(404, 'Course not found');
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
		success: true,
		id
	};
});

export const deleteCourse = command(z.string(), async (id) => {
	requireTeacherOrAdmin();

	const existing = await db.select().from(courses).where(eq(courses.id, id));
	if (existing.length === 0) {
		error(404, 'Course not found');
	}

	// Delete the course (cascade will delete related courseExercises and courseUsers)
	await db.delete(courses).where(eq(courses.id, id));

	return {
		success: true
	};
});
