import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, command } from '$app/server';
import { db } from '$lib/server/db/client';
import { courses, courseExercises, courseUsers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeacherOrAdmin } from '$lib/utils/requireAuth';

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
