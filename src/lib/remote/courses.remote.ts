import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, command } from '$app/server';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import {
	attempts,
	courseExercises,
	courseUsers,
	courses,
	exercises,
	achievements
} from '$lib/server/db/schema';
import { writeAuditLog } from '$lib/server/audit';
import { gradeExerciseAuthoritatively } from '$lib/server/authoritative-execution';
import { evaluateAndPersistBadges } from '$lib/server/badges/evaluate';
import { computeCourseAnalytics } from '$lib/analytics/course-analytics';
import { createCourseResearchExport } from '$lib/analytics/research-export';
import {
	SubmittedResultValidationError,
	validateSubmittedVisibleResultShape
} from '$lib/attempts/submission';
import { validateAttemptActorFields } from '$lib/attempts/invariants';
import {
	formatCoursePublishValidationError,
	validateCoursePublishReadiness
} from '$lib/courses/validation';
import {
	contentSchema,
	courseTransferSchema,
	createCourseTransfer
} from '$lib/import-export/transfers';
import { isTeacherOrAdmin, requireAuth, requireTeacherOrAdmin } from '$lib/utils/requireAuth';
import {
	canonicalizeExercise,
	dehydrateExercise,
	stripExerciseForLearners,
	type Exercise
} from '$lib/types/exercise';
import type { AttemptAnalytics, AttemptLocale, HintRevealEvent } from '$lib/types/attempt';

// =============================================================================
// Schemas
// =============================================================================

const createCourseSchema = z.object({
	content: contentSchema,
	published: z.boolean().optional().default(false),
	exerciseIds: z.array(z.string()).optional().default([]),
	userIds: z.array(z.string()).optional().default([])
});

const updateCourseSchema = createCourseSchema.extend({ id: z.string() });
const courseCloneSchema = z.object({ id: z.string() });
const courseArchiveSchema = z.object({ id: z.string() });
const importCourseSchema = z.object({ payload: courseTransferSchema });

const hintRevealEventSchema = z.object({
	hintId: z.string(),
	revealedAt: z.number(),
	trigger: z.enum(['click', 'time'])
});

const attemptAnalyticsSchema = z.object({
	exerciseType: z.enum(['io', 'turtle', 'robot']),
	totalTests: z.number().int().nonnegative(),
	passedTests: z.number().int().nonnegative(),
	hintUsageCount: z.number().int().nonnegative(),
	submittedAt: z.number(),
	workspaceBlockCount: z.number().int().nonnegative().optional(),
	generatedCodeLength: z.number().int().nonnegative().optional(),
	importedFromGuest: z
		.object({ clientId: z.string(), importedAt: z.number() })
		.optional()
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

const submitAttemptSchema = z.object({
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
});

// =============================================================================
// Helpers
// =============================================================================

function sanitizeHintEventsJson(value: string) {
	try {
		const parsed = z.array(hintRevealEventSchema).parse(JSON.parse(value));
		return JSON.stringify(parsed satisfies HintRevealEvent[]);
	} catch {
		return '[]';
	}
}

function sanitizeAnalyticsJson(value: string, defaults: AttemptAnalytics) {
	try {
		const parsed = attemptAnalyticsSchema.parse({ ...defaults, ...JSON.parse(value) });
		return { raw: JSON.stringify(parsed), parsed };
	} catch {
		return { raw: JSON.stringify(defaults), parsed: defaults };
	}
}

function countHintEvents(value: string) {
	try {
		return z.array(hintRevealEventSchema).parse(JSON.parse(value)).length;
	} catch {
		return 0;
	}
}

function parseAttemptAnalytics(value: string, exerciseType: Exercise['type']): AttemptAnalytics {
	return sanitizeAnalyticsJson(value, {
		exerciseType,
		totalTests: 0,
		passedTests: 0,
		hintUsageCount: 0,
		submittedAt: Date.now()
	}).parsed;
}

async function mapCoursesWithRelations(
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
			: []
	}));
}

async function loadPublishedCourseExercises(courseId: string): Promise<Exercise[]> {
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

async function loadCoursePublishExercises(exerciseIds: string[]) {
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

async function validatePublishedCourseInput(
	content: z.infer<typeof contentSchema>,
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

// =============================================================================
// Queries
// =============================================================================

export const getCourses = query('unchecked', async () => {
	requireTeacherOrAdmin();
	return mapCoursesWithRelations(await db.select().from(courses), { includeUsers: true });
});

/**
 * Get a single course by ID. Teachers/admins receive exerciseIds and userIds in
 * addition to the base course row; learners get only the base row.
 */
export const getCourse = query(z.string(), async (id) => {
	const [course] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
	if (!course) error(404, 'Course not found');

	if (!isTeacherOrAdmin()) return course;

	const exerciseRelations = await db
		.select()
		.from(courseExercises)
		.where(eq(courseExercises.courseId, id));
	const userRelations = await db.select().from(courseUsers).where(eq(courseUsers.courseId, id));

	return {
		...course,
		exerciseIds: exerciseRelations.sort((a, b) => a.order - b.order).map((r) => r.exerciseId),
		userIds: userRelations.map((r) => r.userId)
	};
});

/**
 * Courses assigned to the current user, with per-course progress.
 * Only includes published, non-archived courses.
 */
export const getUserCourses = query('unchecked', async () => {
	const user = requireAuth();

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
		.from(courseUsers)
		.innerJoin(courses, eq(courses.id, courseUsers.courseId))
		.where(
			and(
				eq(courseUsers.userId, user.id),
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
		.where(and(inArray(courseExercises.courseId, courseIds), eq(attempts.userId, user.id)))
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
});

/**
 * All published exercises for a course, ordered. Requires the user to be
 * assigned to the course.
 */
export const getCourseExercises = query(z.string(), async (courseId) => {
	const user = requireAuth();

	const access = await db
		.select()
		.from(courseUsers)
		.where(and(eq(courseUsers.courseId, courseId), eq(courseUsers.userId, user.id)));
	if (access.length === 0) error(403, 'You do not have access to this course');

	const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
	if (!course) error(404, 'Course not found');
	if (!course.published || course.archivedAt != null) {
		error(403, 'This course is not published');
	}

	return loadPublishedCourseExercises(courseId);
});

/**
 * Published, non-archived courses with their exercise/user relations. Used by
 * the public demo page and any unauthenticated browse views.
 */
export const getPublicCourses = query('unchecked', async () => {
	const publicCourses = (await db.select().from(courses)).filter(
		(course) => course.published && course.archivedAt == null
	);
	return mapCoursesWithRelations(publicCourses, { publishedExercisesOnly: true });
});

export const getPublicCourseExercises = query(z.string(), async (courseId) => {
	const [course] = await db
		.select()
		.from(courses)
		.where(and(eq(courses.id, courseId), eq(courses.published, true)))
		.limit(1);
	if (!course || course.archivedAt != null) error(404, 'Course not found');
	return loadPublishedCourseExercises(courseId);
});

export const getEarnedBadges = query(async () => {
	const user = requireAuth();
	return db
		.select({ badgeKey: achievements.badgeKey, awardedAt: achievements.awardedAt })
		.from(achievements)
		.where(eq(achievements.userId, user.id))
		.orderBy(desc(achievements.awardedAt));
});

/**
 * User's progress for a course: best attempt per exercise and latest snapshots.
 */
export const getCourseProgress = query(z.string(), async (courseId) => {
	const user = requireAuth();

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
		.where(eq(attempts.userId, user.id))
		.orderBy(desc(attempts.createdAt));

	const exerciseProgress: Record<
		string,
		{ passed: boolean; bestScore: number; attemptCount: number }
	> = {};
	const latestSnapshots: Record<string, { workspaceXml: string; resultJson: string }> = {};

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
});

/**
 * Aggregate analytics for a course (teacher/admin only).
 */
export const getCourseAnalytics = query(
	z.object({ courseId: z.string() }),
	async ({ courseId }) => {
		requireTeacherOrAdmin();

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
);

/**
 * All attempts for a course, structured for CSV export.
 */
export const exportCourseAttempts = query(
	z.object({ courseId: z.string() }),
	async ({ courseId }) => {
		requireTeacherOrAdmin();

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
);

/**
 * Course attempts for thesis/evaluation work without raw user or attempt ids.
 */
export const exportCourseResearch = query(
	z.object({ courseId: z.string() }),
	async ({ courseId }) => {
		requireTeacherOrAdmin();

		const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
		if (!course) error(404, 'Course not found');

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
);

export const exportCourse = query(z.object({ id: z.string() }), async ({ id }) => {
	requireTeacherOrAdmin();

	const [course] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
	if (!course) error(404, 'Course not found');

	const relations = await db
		.select()
		.from(courseExercises)
		.where(eq(courseExercises.courseId, id))
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

	return createCourseTransfer(
		{ id: course.id, content: course.content, published: course.published },
		rows.filter((r): r is NonNullable<typeof r> => Boolean(r))
	);
});

// =============================================================================
// Commands
// =============================================================================

export const submitAttempt = command(submitAttemptSchema, async (data) => {
	const user = requireAuth();

	const [exerciseRow] = await db
		.select()
		.from(exercises)
		.where(eq(exercises.id, data.exerciseId))
		.limit(1);
	if (!exerciseRow || !exerciseRow.published || exerciseRow.archivedAt != null) {
		error(404, 'Exercise not found');
	}

	const relatedCourses = await db
		.select({ courseId: courseExercises.courseId })
		.from(courseExercises)
		.where(eq(courseExercises.exerciseId, data.exerciseId));
	if (relatedCourses.length === 0) error(400, 'Exercise is not assigned to a course');

	const accessRows = await db
		.select({ courseId: courseUsers.courseId })
		.from(courseUsers)
		.where(eq(courseUsers.userId, user.id));
	const allowedCourseIds = new Set(accessRows.map((r) => r.courseId));
	if (!relatedCourses.some((r) => allowedCourseIds.has(r.courseId))) {
		error(403, 'You do not have access to this exercise');
	}

	const canonicalExercise = canonicalizeExercise({
		...exerciseRow,
		content: exerciseRow.content,
		config: exerciseRow.config,
		validationJson: exerciseRow.validationJson,
		image: exerciseRow.image
	});

	try {
		validateSubmittedVisibleResultShape(canonicalExercise, data.resultJson);
	} catch (cause) {
		if (cause instanceof SubmittedResultValidationError) throw error(400, cause.message);
		throw cause;
	}

	const hintEventsJson = sanitizeHintEventsJson(data.hintEventsJson);
	const analyticsJson = sanitizeAnalyticsJson(data.analyticsJson, {
		exerciseType: canonicalExercise.type,
		totalTests: 0,
		passedTests: 0,
		hintUsageCount: 0,
		submittedAt: Date.now(),
		generatedCodeLength: data.generatedCode.length
	}).raw;

	let authoritative;
	try {
		authoritative = await gradeExerciseAuthoritatively(canonicalExercise, data.generatedCode);
	} catch (gradingError) {
		console.error('Authoritative grading failed:', gradingError);
		throw error(400, 'Could not grade submitted solution authoritatively');
	}

	const id = crypto.randomUUID();
	const endedAt = data.endedAt ?? Date.now();
	const attemptActor = { userId: user.id, clientId: null, actorType: 'user' as const };
	validateAttemptActorFields(attemptActor);

	await db.insert(attempts).values({
		id,
		exerciseId: data.exerciseId,
		...attemptActor,
		workspaceXml: data.workspaceXml,
		generatedCode: data.generatedCode,
		resultJson: authoritative.resultJson,
		score: authoritative.grading.score,
		passed: authoritative.grading.passed,
		startedAt: data.startedAt,
		endedAt,
		locale: data.locale,
		hintEventsJson,
		analyticsJson,
		createdAt: endedAt
	});

	const newBadges = await evaluateAndPersistBadges({
		userId: user.id,
		attemptSignal: {
			exerciseId: data.exerciseId,
			passed: authoritative.grading.passed,
			score: authoritative.grading.score,
			hintEventCount: countHintEvents(hintEventsJson),
			locale: data.locale
		},
		relatedCourseIds: relatedCourses.map((r) => r.courseId)
	});

	return {
		id,
		success: true as const,
		grading: authoritative.grading,
		resultJson: authoritative.resultJson,
		newBadges
	};
});

export const importGuestAttempts = command(
	z.object({ attempts: z.array(guestAttemptImportSchema) }),
	async ({ attempts: guestAttempts }) => {
		const user = requireAuth();
		if (guestAttempts.length === 0) return { success: true as const, importedCount: 0 };

		const existingIds = new Set(
			(
				await db.select({ id: attempts.id }).from(attempts).where(eq(attempts.userId, user.id))
			).map((a) => a.id)
		);

		const values = [];
		for (const attempt of guestAttempts) {
			if (existingIds.has(attempt.id)) continue;

			const [exerciseRow] = await db
				.select()
				.from(exercises)
				.where(eq(exercises.id, attempt.exerciseId))
				.limit(1);
			if (!exerciseRow || !exerciseRow.published || exerciseRow.archivedAt != null) continue;

			const canonicalExercise = canonicalizeExercise({
				...exerciseRow,
				content: exerciseRow.content,
				config: exerciseRow.config,
				validationJson: exerciseRow.validationJson,
				image: exerciseRow.image
			});

			let authoritative;
			try {
				authoritative = await gradeExerciseAuthoritatively(canonicalExercise, attempt.generatedCode);
			} catch {
				continue;
			}

			const hintEventsJson = sanitizeHintEventsJson(attempt.hintEventsJson);
			const analyticsJson = sanitizeAnalyticsJson(attempt.analyticsJson, {
				exerciseType: canonicalExercise.type,
				totalTests: authoritative.grading.totalTests,
				passedTests: authoritative.grading.passedTests,
				hintUsageCount: 0,
				submittedAt: attempt.endedAt,
				generatedCodeLength: attempt.generatedCode.length,
				importedFromGuest: { clientId: attempt.clientId, importedAt: Date.now() }
			}).raw;

			const attemptActor = { userId: user.id, clientId: null, actorType: 'user' as const };
			validateAttemptActorFields(attemptActor);

			values.push({
				id: attempt.id,
				exerciseId: attempt.exerciseId,
				...attemptActor,
				workspaceXml: attempt.workspaceXml,
				generatedCode: attempt.generatedCode,
				resultJson: authoritative.resultJson,
				score: authoritative.grading.score,
				passed: authoritative.grading.passed,
				startedAt: attempt.startedAt,
				endedAt: attempt.endedAt,
				locale: attempt.locale as AttemptLocale,
				hintEventsJson,
				analyticsJson,
				createdAt: attempt.createdAt
			});
		}

		if (values.length === 0) return { success: true as const, importedCount: 0 };

		await db.insert(attempts).values(values);
		await writeAuditLog({
			actorUserId: user.id,
			action: 'guest.import',
			details: {
				importedCount: values.length,
				submittedCount: guestAttempts.length,
				skippedCount: guestAttempts.length - values.length
			}
		});

		return { success: true as const, importedCount: values.length };
	}
);

export const createCourse = command(createCourseSchema, async (data) => {
	const user = requireTeacherOrAdmin();
	const { content, published, exerciseIds, userIds } = data;
	const targetPublished = published ?? false;

	if (targetPublished) {
		const validationError = await validatePublishedCourseInput(content, exerciseIds);
		if (validationError) return { success: false as const, error: validationError };
	}

	const id = crypto.randomUUID();
	const now = Date.now();

	try {
		await db.insert(courses).values({
			id,
			content,
			published: targetPublished,
			archivedAt: null,
			archivedBy: null,
			createdAt: now,
			updatedAt: new Date(now),
			createdBy: user.email ?? ''
		});

		if (exerciseIds.length > 0) {
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

		if (userIds.length > 0) {
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

		await writeAuditLog({
			actorUserId: user.id,
			action: 'course.create',
			details: { courseId: id, published: targetPublished }
		});

		return { success: true as const, id };
	} catch (e) {
		console.error('Error creating course:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to create course'
		};
	}
});

export const updateCourse = command(updateCourseSchema, async (data) => {
	const user = requireTeacherOrAdmin();
	const { id, content, published, exerciseIds, userIds } = data;
	const targetPublished = published ?? false;
	const now = Date.now();

	const [existing] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
	if (!existing) return { success: false as const, error: 'Course not found' };

	if (targetPublished) {
		const validationError = await validatePublishedCourseInput(content, exerciseIds);
		if (validationError) return { success: false as const, error: validationError };
	}

	try {
		await db
			.update(courses)
			.set({
				content,
				published: targetPublished,
				archivedAt: existing.archivedAt,
				archivedBy: existing.archivedBy,
				updatedAt: new Date(now)
			})
			.where(eq(courses.id, id));

		await db.delete(courseExercises).where(eq(courseExercises.courseId, id));
		if (exerciseIds.length > 0) {
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

		await db.delete(courseUsers).where(eq(courseUsers.courseId, id));
		if (userIds.length > 0) {
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

		await writeAuditLog({
			actorUserId: user.id,
			action: 'course.update',
			details: { courseId: id, published: targetPublished }
		});

		return { success: true as const, id };
	} catch (e) {
		console.error('Error updating course:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to update course'
		};
	}
});

export const deleteCourse = command(z.string(), async (id) => {
	const user = requireTeacherOrAdmin();
	const [existing] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
	if (!existing) return { success: false as const, error: 'Course not found' };

	await db.delete(courses).where(eq(courses.id, id));
	await writeAuditLog({
		actorUserId: user.id,
		action: 'course.delete',
		details: { courseId: id }
	});
	return { success: true as const };
});

export const cloneCourse = command(courseCloneSchema, async ({ id }) => {
	const user = requireTeacherOrAdmin();
	const [existing] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
	if (!existing) return { success: false as const, error: 'Course not found' };

	const relations = await db
		.select()
		.from(courseExercises)
		.where(eq(courseExercises.courseId, id))
		.orderBy(courseExercises.order);
	const userRelations = await db.select().from(courseUsers).where(eq(courseUsers.courseId, id));

	const cloneId = crypto.randomUUID();
	const now = Date.now();

	await db.insert(courses).values({
		id: cloneId,
		content: existing.content,
		published: false,
		archivedAt: null,
		archivedBy: null,
		createdAt: now,
		updatedAt: new Date(now),
		createdBy: user.email ?? ''
	});

	if (relations.length > 0) {
		await db.insert(courseExercises).values(
			relations.map((relation) => ({
				id: crypto.randomUUID(),
				courseId: cloneId,
				exerciseId: relation.exerciseId,
				order: relation.order,
				createdAt: now,
				updatedAt: now
			}))
		);
	}

	if (userRelations.length > 0) {
		await db.insert(courseUsers).values(
			userRelations.map((relation) => ({
				id: crypto.randomUUID(),
				courseId: cloneId,
				userId: relation.userId,
				createdAt: now,
				updatedAt: now
			}))
		);
	}

	await writeAuditLog({
		actorUserId: user.id,
		action: 'course.clone',
		details: { sourceCourseId: id, courseId: cloneId }
	});

	return { success: true as const, id: cloneId };
});

export const archiveCourse = command(courseArchiveSchema, async ({ id }) => {
	const user = requireTeacherOrAdmin();
	const [existing] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
	if (!existing) return { success: false as const, error: 'Course not found' };

	await db
		.update(courses)
		.set({
			published: false,
			archivedAt: Date.now(),
			archivedBy: user.id,
			updatedAt: new Date()
		})
		.where(eq(courses.id, id));
	await writeAuditLog({
		actorUserId: user.id,
		action: 'course.archive',
		details: { courseId: id }
	});
	return { success: true as const };
});

export const restoreCourse = command(courseArchiveSchema, async ({ id }) => {
	const user = requireTeacherOrAdmin();
	const [existing] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
	if (!existing) return { success: false as const, error: 'Course not found' };

	await db
		.update(courses)
		.set({ archivedAt: null, archivedBy: null, updatedAt: new Date() })
		.where(eq(courses.id, id));
	await writeAuditLog({
		actorUserId: user.id,
		action: 'course.restore',
		details: { courseId: id }
	});
	return { success: true as const };
});

export const importCourse = command(importCourseSchema, async ({ payload }) => {
	const user = requireTeacherOrAdmin();
	const now = Date.now();

	try {
		const courseId = crypto.randomUUID();
		await db.insert(courses).values({
			id: courseId,
			content: payload.course.content,
			published: false,
			archivedAt: null,
			archivedBy: null,
			createdAt: now,
			updatedAt: new Date(now),
			createdBy: user.email ?? ''
		});

		for (const [index, exercisePayload] of payload.exercises.entries()) {
			const exerciseId = crypto.randomUUID();
			const persisted = dehydrateExercise({
				id: exerciseId,
				courseId,
				type: exercisePayload.type,
				content: exercisePayload.content,
				config: exercisePayload.config,
				published: false,
				order: exercisePayload.order,
				createdBy: user.id,
				createdAt: now,
				updatedAt: now,
				archivedAt: null,
				archivedBy: null
			});

			await db.insert(exercises).values({
				id: persisted.exercise.id,
				courseId: persisted.exercise.courseId,
				type: persisted.exercise.type,
				image: persisted.exercise.content.image ?? '',
				content: persisted.content,
				config: persisted.config,
				validationJson: persisted.validation,
				published: false,
				archivedAt: null,
				archivedBy: null,
				order: persisted.exercise.order,
				createdBy: persisted.exercise.createdBy,
				createdAt: persisted.exercise.createdAt,
				updatedAt: persisted.exercise.updatedAt
			});

			await db.insert(courseExercises).values({
				id: crypto.randomUUID(),
				courseId,
				exerciseId,
				order: index,
				createdAt: now,
				updatedAt: now
			});
		}

		await writeAuditLog({
			actorUserId: user.id,
			action: 'course.import',
			details: { courseId, exerciseCount: payload.exercises.length }
		});

		return { success: true as const, id: courseId };
	} catch (e) {
		console.error('Error importing course:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to import course'
		};
	}
});
