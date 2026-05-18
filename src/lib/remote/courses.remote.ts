import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, command } from '$app/server';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import { courses, user } from '$lib/server/db/schema';
import { writeAuditLog } from '$lib/server/audit';
import { createCourseTransfer } from '$lib/import-export/transfers';
import {
	currentUser,
	isTeacherOrAdmin,
	requireAuth,
	requireTeacherOrAdmin
} from '$lib/utils/requireAuth';
import {
	listAssignedCoursesForUser,
	loadCourseAnalytics,
	loadCourseAttemptsExport,
	loadCourseExercisesForExport,
	loadCourseExercisesForMember,
	loadCourseProgress,
	loadCourseResearchExport,
	loadCourseRow,
	loadCourseWithRelations,
	loadEarnedBadges,
	loadPublicCourseExercises,
	loadPublicCourses,
	loadStaffCourses
} from '$lib/server/courses/queries';
import {
	archiveCourseImpl,
	cloneCourseImpl,
	createCourseImpl,
	deleteCourseImpl,
	importCourseImpl,
	restoreCourseImpl,
	submitAttemptImpl,
	updateCourseImpl
} from '$lib/server/courses/mutations';
import {
	courseArchiveSchema,
	courseCloneSchema,
	createCourseSchema,
	importCourseSchema,
	submitAttemptSchema,
	updateCourseSchema
} from '$lib/server/courses/schemas';

// =============================================================================
// Queries — thin wrappers around src/lib/server/courses/queries.ts
// =============================================================================

export const getCourses = query('unchecked', async () => {
	requireTeacherOrAdmin();
	return loadStaffCourses();
});

/**
 * Get a single course by ID. Teachers/admins receive exerciseIds and userIds in
 * addition to the base course row; learners get only the base row.
 */
export const getCourse = query(z.string(), async (id) => {
	const course = await loadCourseRow(id);
	if (!course) error(404, 'Course not found');

	if (!isTeacherOrAdmin()) {
		const actor = currentUser();
		if (actor) {
			void writeAuditLog({
				actorUserId: actor.id,
				action: 'course.open',
				category: 'user',
				details: { courseId: id }
			});
		}
		return course;
	}

	return loadCourseWithRelations(course);
});

/**
 * Courses assigned to the current user, with per-course progress. Published,
 * non-archived only.
 */
export const getUserCourses = query('unchecked', async () => {
	const user = requireAuth();
	return listAssignedCoursesForUser(user.id);
});

/**
 * All published exercises for a course, ordered. Requires the user to be
 * assigned to the course.
 */
export const getCourseExercises = query(z.string(), async (courseId) => {
	const user = requireAuth();
	const result = await loadCourseExercisesForMember(user.id, courseId);
	if (result.reason === 'not-member') error(403, 'You do not have access to this course');
	if (result.reason === 'not-found') error(404, 'Course not found');
	if (result.reason === 'not-published') error(403, 'This course is not published');
	return result.exercises;
});

/**
 * Published, non-archived courses with their exercise/user relations. Used by
 * the public demo page and any unauthenticated browse views.
 */
export const getPublicCourses = query('unchecked', loadPublicCourses);

export const getPublicCourseExercises = query(z.string(), async (courseId) => {
	const result = await loadPublicCourseExercises(courseId);
	if (result.reason === 'not-found') error(404, 'Course not found');
	return result.exercises;
});

export const getEarnedBadges = query(async () => {
	const user = requireAuth();
	return loadEarnedBadges(user.id);
});

/**
 * User's progress for a course: best attempt per exercise and latest snapshots.
 */
export const getCourseProgress = query(z.string(), async (courseId) => {
	const user = requireAuth();
	return loadCourseProgress(user.id, courseId);
});

/**
 * Aggregate analytics for a course (teacher/admin only).
 */
export const getCourseAnalytics = query(
	z.object({ courseId: z.string() }),
	async ({ courseId }) => {
		requireTeacherOrAdmin();
		return loadCourseAnalytics(courseId);
	}
);

/**
 * All attempts for a course, structured for CSV export.
 */
export const exportCourseAttempts = query(
	z.object({ courseId: z.string() }),
	async ({ courseId }) => {
		requireTeacherOrAdmin();
		return loadCourseAttemptsExport(courseId);
	}
);

/**
 * Course attempts for thesis/evaluation work without raw user or attempt ids.
 */
export const exportCourseResearch = query(
	z.object({ courseId: z.string() }),
	async ({ courseId }) => {
		requireTeacherOrAdmin();
		const result = await loadCourseResearchExport(courseId);
		if (!result) error(404, 'Course not found');
		return result;
	}
);

export const exportCourse = query(z.object({ id: z.string() }), async ({ id }) => {
	requireTeacherOrAdmin();
	const course = await loadCourseRow(id);
	if (!course) error(404, 'Course not found');
	const exerciseRows = await loadCourseExercisesForExport(id);
	return createCourseTransfer(
		{ id: course.id, content: course.content, published: course.published },
		exerciseRows
	);
});

// =============================================================================
// Commands — thin wrappers around src/lib/server/courses/mutations.ts
// =============================================================================

export const submitAttempt = command(submitAttemptSchema, async (data) => {
	const user = requireAuth();
	return submitAttemptImpl(user, data);
});

export const createCourse = command(createCourseSchema, async (data) => {
	const user = requireTeacherOrAdmin();
	return createCourseImpl(user, data);
});

export const updateCourse = command(updateCourseSchema, async (data) => {
	const user = requireTeacherOrAdmin();
	return updateCourseImpl(user, data);
});

export const deleteCourse = command(z.string(), async (id) => {
	const user = requireTeacherOrAdmin();
	return deleteCourseImpl(user, id);
});

export const cloneCourse = command(courseCloneSchema, async (data) => {
	const user = requireTeacherOrAdmin();
	return cloneCourseImpl(user, data);
});

export const archiveCourse = command(courseArchiveSchema, async (data) => {
	const user = requireTeacherOrAdmin();
	return archiveCourseImpl(user, data);
});

export const restoreCourse = command(courseArchiveSchema, async (data) => {
	const user = requireTeacherOrAdmin();
	return restoreCourseImpl(user, data);
});

export const importCourse = command(importCourseSchema, async (data) => {
	const user = requireTeacherOrAdmin();
	return importCourseImpl(user, data);
});

// Reassign a course's author. Stores the target user's email in createdBy to
// match the legacy text-only storage. Any teacher/admin can reassign.
export const setCourseAuthor = command(
	z.object({ courseId: z.string().min(1), userId: z.string().min(1) }),
	async ({ courseId, userId }) => {
		const actor = requireTeacherOrAdmin();

		const [target] = await db
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		if (!target) return { success: false as const, error: 'Target user not found' };

		const [existing] = await db
			.select({ id: courses.id, createdBy: courses.createdBy })
			.from(courses)
			.where(eq(courses.id, courseId))
			.limit(1);
		if (!existing) return { success: false as const, error: 'Course not found' };

		await db
			.update(courses)
			.set({ createdBy: target.email, updatedAt: new Date() })
			.where(eq(courses.id, courseId));

		await writeAuditLog({
			actorUserId: actor.id,
			action: 'course.author.set',
			category: 'admin',
			details: {
				courseId,
				previousCreatedBy: existing.createdBy,
				newCreatedBy: target.email,
				newAuthorUserId: userId
			}
		});
		return { success: true as const };
	}
);
