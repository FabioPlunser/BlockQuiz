// Effective course enrolment for a user. A user is enrolled in a course either
// directly (`courseUsers` row) OR via membership in a class that is linked to
// the course (`classUsers` → `courseClasses`). Archived classes are excluded.
//
// This helper is the single source of truth for "can this user access this
// course". Every access check that gates on enrolment must go through it.

import { and, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import { classes, classUsers, courseClasses, courseUsers } from '$lib/server/db/schema';

/**
 * Returns the set of course ids the user is currently enrolled in via any path.
 * Duplicates (direct + via class) are deduped by the Set semantics.
 */
export async function getEnrolledCourseIds(userId: string): Promise<Set<string>> {
	const [direct, viaClass] = await Promise.all([
		db
			.select({ id: courseUsers.courseId })
			.from(courseUsers)
			.where(eq(courseUsers.userId, userId)),
		db
			.select({ id: courseClasses.courseId })
			.from(classUsers)
			.innerJoin(courseClasses, eq(courseClasses.classId, classUsers.classId))
			.innerJoin(classes, eq(classes.id, classUsers.classId))
			.where(and(eq(classUsers.userId, userId), isNull(classes.archivedAt)))
	]);
	return new Set([...direct.map((r) => r.id), ...viaClass.map((r) => r.id)]);
}

/**
 * Cheap predicate variant for a single course check. Same semantics as
 * getEnrolledCourseIds(userId).has(courseId) but does no extra work for the
 * other courses.
 */
export async function isEnrolledInCourse(userId: string, courseId: string): Promise<boolean> {
	const [directHit] = await db
		.select({ id: courseUsers.courseId })
		.from(courseUsers)
		.where(and(eq(courseUsers.userId, userId), eq(courseUsers.courseId, courseId)))
		.limit(1);
	if (directHit) return true;

	const [viaClassHit] = await db
		.select({ id: courseClasses.courseId })
		.from(classUsers)
		.innerJoin(courseClasses, eq(courseClasses.classId, classUsers.classId))
		.innerJoin(classes, eq(classes.id, classUsers.classId))
		.where(
			and(
				eq(classUsers.userId, userId),
				eq(courseClasses.courseId, courseId),
				isNull(classes.archivedAt)
			)
		)
		.limit(1);
	return Boolean(viaClassHit);
}
