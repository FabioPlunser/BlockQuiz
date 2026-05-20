import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import {
	attempts,
	classUsers,
	classes,
	courseClasses,
	courseExercises,
	exercises,
	user
} from '$lib/server/db/schema';
import {
	computeClassAnalytics,
	computeClassAnalyticsList,
	type ClassAnalytics,
	type ClassAnalyticsSummary
} from '$lib/analytics/class-analytics';
import { computeCourseAnalytics, type CourseAnalytics } from '$lib/analytics/course-analytics';
import { countHintEvents, parseAttemptAnalytics } from '$lib/server/courses/helpers';
import type { Exercise } from '$lib/types/exercise';

const helpers = { countHintEvents, parseAttemptAnalytics };

/** L1: all classes with class-level rollup metrics. */
export async function loadClassesAnalytics(): Promise<ClassAnalyticsSummary[]> {
	const [classRows, classUserRows, courseClassRows, courseExerciseRows, exerciseRows, attemptRows] =
		await Promise.all([
			db.select().from(classes),
			db.select().from(classUsers),
			db.select().from(courseClasses),
			db.select().from(courseExercises),
			db.select().from(exercises),
			db.select().from(attempts)
		]);

	const courseIdsByClass = new Map<string, Set<string>>();
	for (const cc of courseClassRows) {
		let set = courseIdsByClass.get(cc.classId);
		if (!set) {
			set = new Set();
			courseIdsByClass.set(cc.classId, set);
		}
		set.add(cc.courseId);
	}

	const exerciseIdsByCourse = new Map<string, Set<string>>();
	for (const ce of courseExerciseRows) {
		let set = exerciseIdsByCourse.get(ce.courseId);
		if (!set) {
			set = new Set();
			exerciseIdsByCourse.set(ce.courseId, set);
		}
		set.add(ce.exerciseId);
	}

	const userIdsByClass = new Map<string, Set<string>>();
	for (const cu of classUserRows) {
		let set = userIdsByClass.get(cu.classId);
		if (!set) {
			set = new Set();
			userIdsByClass.set(cu.classId, set);
		}
		set.add(cu.userId);
	}

	const input = classRows.map((cls) => {
		const courseIds = Array.from(courseIdsByClass.get(cls.id) ?? []);
		const exerciseIdSet = new Set<string>();
		for (const courseId of courseIds) {
			const set = exerciseIdsByCourse.get(courseId);
			if (set) for (const eid of set) exerciseIdSet.add(eid);
		}
		const enrolledUserIds = Array.from(userIdsByClass.get(cls.id) ?? []);
		return {
			classId: cls.id,
			className: cls.name,
			description: cls.description,
			archivedAt: cls.archivedAt,
			courseIds,
			exerciseIds: Array.from(exerciseIdSet),
			enrolledUserIds
		};
	});

	const summaries = computeClassAnalyticsList({
		classes: input,
		exerciseRows,
		attemptRows,
		...helpers
	});

	return summaries.sort((a, b) => {
		const archivedA = a.archivedAt != null ? 1 : 0;
		const archivedB = b.archivedAt != null ? 1 : 0;
		if (archivedA !== archivedB) return archivedA - archivedB;
		return a.className.localeCompare(b.className);
	});
}

type ClassScope = {
	classRow: typeof classes.$inferSelect;
	courseIds: string[];
	exerciseIds: string[];
	enrolledUsers: Array<{ id: string; name: string | null; email: string }>;
};

async function loadClassScope(classId: string): Promise<ClassScope | null> {
	const [classRow] = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
	if (!classRow) return null;

	const courseClassRows = await db
		.select()
		.from(courseClasses)
		.where(eq(courseClasses.classId, classId));
	const courseIds = courseClassRows.map((r) => r.courseId);

	let exerciseIds: string[] = [];
	if (courseIds.length > 0) {
		const courseExerciseRows = await db
			.select()
			.from(courseExercises)
			.where(inArray(courseExercises.courseId, courseIds))
			.orderBy(courseExercises.order);
		exerciseIds = Array.from(new Set(courseExerciseRows.map((r) => r.exerciseId)));
	}

	const enrolmentRows = await db.select().from(classUsers).where(eq(classUsers.classId, classId));
	const enrolledUserIdSet = new Set(enrolmentRows.map((r) => r.userId));
	const enrolledUsers =
		enrolledUserIdSet.size > 0
			? (
					await db
						.select({ id: user.id, name: user.name, email: user.email })
						.from(user)
						.where(inArray(user.id, Array.from(enrolledUserIdSet)))
				).map((row) => ({ id: row.id, name: row.name, email: row.email }))
			: [];

	return { classRow, courseIds, exerciseIds, enrolledUsers };
}

/** L2: class detail with one row per enrolled student. */
export async function loadClassAnalytics(classId: string): Promise<ClassAnalytics | null> {
	const scope = await loadClassScope(classId);
	if (!scope) return null;

	const [exerciseRows, attemptRows] = await Promise.all([
		scope.exerciseIds.length > 0
			? db.select().from(exercises).where(inArray(exercises.id, scope.exerciseIds))
			: Promise.resolve([] as Array<typeof exercises.$inferSelect>),
		scope.exerciseIds.length > 0 && scope.enrolledUsers.length > 0
			? db
					.select()
					.from(attempts)
					.where(inArray(attempts.exerciseId, scope.exerciseIds))
			: Promise.resolve([] as Array<typeof attempts.$inferSelect>)
	]);

	return computeClassAnalytics({
		classId: scope.classRow.id,
		className: scope.classRow.name,
		description: scope.classRow.description,
		archivedAt: scope.classRow.archivedAt,
		exerciseIds: scope.exerciseIds,
		courseIds: scope.courseIds,
		enrolledUsers: scope.enrolledUsers,
		exerciseRows,
		attemptRows,
		...helpers
	});
}

/** L3: per-exercise breakdown for one student inside one class (reuses course-analytics shape). */
export async function loadStudentClassAnalytics(
	classId: string,
	studentId: string
): Promise<
	| (CourseAnalytics & {
			classId: string;
			className: string;
			student: { userId: string; name: string; email: string };
	  })
	| null
> {
	const scope = await loadClassScope(classId);
	if (!scope) return null;

	const studentRecord = scope.enrolledUsers.find((u) => u.id === studentId);
	if (!studentRecord) return null;

	const [exerciseRows, attemptRowsAll] = await Promise.all([
		scope.exerciseIds.length > 0
			? db.select().from(exercises).where(inArray(exercises.id, scope.exerciseIds))
			: Promise.resolve([] as Array<typeof exercises.$inferSelect>),
		scope.exerciseIds.length > 0
			? db
					.select()
					.from(attempts)
					.where(inArray(attempts.exerciseId, scope.exerciseIds))
			: Promise.resolve([] as Array<typeof attempts.$inferSelect>)
	]);

	const attemptRows = attemptRowsAll.filter((a) => a.userId === studentId);

	const analytics = computeCourseAnalytics({
		exerciseIds: scope.exerciseIds,
		exerciseRows,
		attemptRows,
		...helpers
	});

	return {
		...analytics,
		classId: scope.classRow.id,
		className: scope.classRow.name,
		student: {
			userId: studentRecord.id,
			name: studentRecord.name ?? studentRecord.email,
			email: studentRecord.email
		}
	};
}

/** Export rows for one class (mirrors loadCourseAttemptsExport shape, adds className). */
export async function loadClassAttemptsExport(classId: string) {
	const scope = await loadClassScope(classId);
	if (!scope) return { rows: [] as Array<Record<string, unknown>> };

	if (scope.exerciseIds.length === 0 || scope.enrolledUsers.length === 0) {
		return { rows: [] };
	}

	const exerciseRows = await db
		.select()
		.from(exercises)
		.where(inArray(exercises.id, scope.exerciseIds));
	const exerciseMap = new Map(exerciseRows.map((e) => [e.id, e]));

	const enrolledIdSet = new Set(scope.enrolledUsers.map((u) => u.id));

	const attemptRows = await db
		.select()
		.from(attempts)
		.where(inArray(attempts.exerciseId, scope.exerciseIds))
		.orderBy(desc(attempts.createdAt));

	const rows = attemptRows
		.filter((a) => a.userId && enrolledIdSet.has(a.userId))
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
				classId,
				className: scope.classRow.name,
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
