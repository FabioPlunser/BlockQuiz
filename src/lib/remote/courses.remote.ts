import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, command } from '$app/server';
import { db } from '$lib/server/db/client';
import {
	courses,
	courseExercises,
	courseUsers,
	exercises,
	attempts,
	achievements
} from '$lib/server/db/schema';
import {
	evaluateBadges,
	type BadgeKey,
	type AttemptSignal,
	type HistorySnapshot
} from '$lib/achievements/rules';
import { eq, and, desc } from 'drizzle-orm';
import { createCourseResearchExport } from '$lib/analytics/research-export';
import {
	SubmittedResultValidationError,
	validateSubmittedVisibleResultShape
} from '$lib/attempts/submission';
import { validateAttemptActorFields } from '$lib/attempts/invariants';
import { writeAuditLog } from '$lib/server/audit';
import {
	formatCoursePublishValidationError,
	validateCoursePublishReadiness
} from '$lib/courses/validation';
import {
	contentSchema,
	courseTransferSchema,
	createCourseTransfer
} from '$lib/import-export/transfers';
import { requireAuth, requireTeacherOrAdmin } from '$lib/utils/requireAuth';
import {
	canonicalizeExercise,
	dehydrateExercise,
	stripExerciseForLearners,
	type Exercise
} from '$lib/types/exercise';
import type { AttemptAnalytics, AttemptLocale, HintRevealEvent } from '$lib/types/attempt';
import { gradeExerciseAuthoritatively } from '$lib/server/authoritative-execution';

// =============================================================================
// Zod Schemas
// =============================================================================
const createCourseSchema = z.object({
	content: contentSchema,
	published: z.boolean().optional().default(false),
	exerciseIds: z.array(z.string()).optional().default([]),
	userIds: z.array(z.string()).optional().default([])
});

const updateCourseSchema = createCourseSchema.extend({
	id: z.string()
});

const courseCloneSchema = z.object({ id: z.string() });
const courseArchiveSchema = z.object({ id: z.string() });
const importCourseSchema = z.object({ payload: courseTransferSchema });

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
		.object({
			clientId: z.string(),
			importedAt: z.number()
		})
		.optional()
});

function sanitizeHintEventsJson(value: string) {
	try {
		const parsed = z.array(hintRevealEventSchema).parse(JSON.parse(value));
		return JSON.stringify(parsed satisfies HintRevealEvent[]);
	} catch {
		return '[]';
	}
}

function sanitizeAnalyticsJson(
	value: string,
	defaults: AttemptAnalytics
): { raw: string; parsed: AttemptAnalytics } {
	try {
		const parsed = attemptAnalyticsSchema.parse({
			...defaults,
			...JSON.parse(value)
		});
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

function getAttemptDurationMs(startedAt: number, endedAt: number) {
	return Math.max(0, endedAt - startedAt);
}

async function evaluateAndPersistBadges(input: {
	userId: string;
	attemptSignal: AttemptSignal;
	relatedCourseIds: string[];
}): Promise<BadgeKey[]> {
	const earnedRows = await db
		.select({ badgeKey: achievements.badgeKey })
		.from(achievements)
		.where(eq(achievements.userId, input.userId));
	const earned = new Set<BadgeKey>(earnedRows.map((row) => row.badgeKey as BadgeKey));

	// Most recent attempts in chronological order; we only need a small window
	// to compute the current pass-streak and the locale set.
	const userAttempts = await db
		.select({
			passed: attempts.passed,
			locale: attempts.locale,
			createdAt: attempts.createdAt
		})
		.from(attempts)
		.where(eq(attempts.userId, input.userId))
		.orderBy(desc(attempts.createdAt))
		.limit(50);

	let currentPassStreak = 0;
	for (const row of userAttempts) {
		if (row.passed) currentPassStreak += 1;
		else break;
	}

	const localesUsed = new Set<'de' | 'en'>();
	for (const row of userAttempts) {
		if (row.passed && (row.locale === 'de' || row.locale === 'en')) {
			localesUsed.add(row.locale);
		}
	}

	let completesCourse = false;
	if (input.attemptSignal.passed && input.relatedCourseIds.length > 0) {
		const passingExerciseIds = new Set(
			(
				await db
					.select({ exerciseId: attempts.exerciseId })
					.from(attempts)
					.where(and(eq(attempts.userId, input.userId), eq(attempts.passed, true)))
			).map((row) => row.exerciseId)
		);
		for (const courseId of input.relatedCourseIds) {
			const courseRows = await db
				.select({ exerciseId: courseExercises.exerciseId })
				.from(courseExercises)
				.where(eq(courseExercises.courseId, courseId));
			if (
				courseRows.length > 0 &&
				courseRows.every((row) => passingExerciseIds.has(row.exerciseId))
			) {
				completesCourse = true;
				break;
			}
		}
	}

	const history: HistorySnapshot = {
		earned,
		currentPassStreak,
		localesUsed,
		completesCourse
	};

	const awards = evaluateBadges(input.attemptSignal, history);
	if (awards.length === 0) return [];

	const now = Date.now();
	await db.insert(achievements).values(
		awards.map((award) => ({
			id: crypto.randomUUID(),
			userId: input.userId,
			badgeKey: award.badge,
			awardedAt: now,
			contextJson: JSON.stringify(award.context)
		}))
	);

	return awards.map((award) => award.badge);
}

async function loadCoursePublishExercises(exerciseIds: string[]) {
	if (exerciseIds.length === 0) {
		return [];
	}

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

	if (!validation.valid) {
		return formatCoursePublishValidationError(validation);
	}

	return null;
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
			.sort((left, right) => left.order - right.order)
			.map((relation) => relation.exerciseId),
		userIds: options.includeUsers
			? allCourseUsers
					.filter((relation) => relation.courseId === course.id)
					.map((relation) => relation.userId)
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
		if (exercise && exercise.archivedAt == null) {
			courseExerciseList.push(
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
		(course) => userCourseIds.includes(course.id) && course.published && course.archivedAt == null
	);

	return mapCoursesWithRelations(userCourses, { publishedExercisesOnly: true });
});

export const getPublicCourses = query('unchecked', async () => {
	const publicCourses = (await db.select().from(courses)).filter(
		(course) => course.published && course.archivedAt == null
	);
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
	if (!course[0].published || course[0].archivedAt != null) {
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

	if (!course || course.archivedAt != null) {
		error(404, 'Course not found');
	}

	return loadPublishedCourseExercises(courseId);
});

/**
 * Submit an attempt for an exercise.
 */
export const getEarnedBadges = query(async () => {
	const user = requireAuth();
	const rows = await db
		.select({
			badgeKey: achievements.badgeKey,
			awardedAt: achievements.awardedAt
		})
		.from(achievements)
		.where(eq(achievements.userId, user.id))
		.orderBy(desc(achievements.awardedAt));
	return rows;
});

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

		if (relatedCourses.length === 0) {
			error(400, 'Exercise is not assigned to a course');
		}

		const accessRows = await db
			.select({ courseId: courseUsers.courseId })
			.from(courseUsers)
			.where(eq(courseUsers.userId, user.id));

		const allowedCourseIds = new Set(accessRows.map((row) => row.courseId));
		if (!relatedCourses.some((row) => allowedCourseIds.has(row.courseId))) {
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
			if (cause instanceof SubmittedResultValidationError) {
				throw error(400, cause.message);
			}
			throw cause;
		}

		const hintEventsJson = sanitizeHintEventsJson(data.hintEventsJson);
		const analyticsDefaults: AttemptAnalytics = {
			exerciseType: canonicalExercise.type,
			totalTests: 0,
			passedTests: 0,
			hintUsageCount: 0,
			submittedAt: Date.now(),
			generatedCodeLength: data.generatedCode.length
		};
		const analyticsJson = sanitizeAnalyticsJson(data.analyticsJson, analyticsDefaults).raw;

		let authoritative;
		try {
			authoritative = await gradeExerciseAuthoritatively(canonicalExercise, data.generatedCode);
		} catch (gradingError) {
			console.error('Authoritative grading failed:', gradingError);
			throw error(400, 'Could not grade submitted solution authoritatively');
		}

		const id = crypto.randomUUID();
		const endedAt = data.endedAt ?? Date.now();

		const attemptActor = {
			userId: user.id,
			clientId: null,
			actorType: 'user' as const
		};
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
			relatedCourseIds: relatedCourses.map((row) => row.courseId)
		});

		return {
			id,
			success: true as const,
			grading: authoritative.grading,
			resultJson: authoritative.resultJson,
			newBadges
		};
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
			(await db.select({ id: attempts.id }).from(attempts).where(eq(attempts.userId, user.id))).map(
				(attempt) => attempt.id
			)
		);

		const values = [];

		for (const attempt of guestAttempts) {
			if (existingAttemptIds.has(attempt.id)) {
				continue;
			}

			const [exerciseRow] = await db
				.select()
				.from(exercises)
				.where(eq(exercises.id, attempt.exerciseId))
				.limit(1);

			if (!exerciseRow || !exerciseRow.published || exerciseRow.archivedAt != null) {
				continue;
			}

			const canonicalExercise = canonicalizeExercise({
				...exerciseRow,
				content: exerciseRow.content,
				config: exerciseRow.config,
				validationJson: exerciseRow.validationJson,
				image: exerciseRow.image
			});

			let authoritative;
			try {
				authoritative = await gradeExerciseAuthoritatively(
					canonicalExercise,
					attempt.generatedCode
				);
			} catch {
				continue;
			}

			const hintEventsJson = sanitizeHintEventsJson(attempt.hintEventsJson);
			const analyticsDefaults: AttemptAnalytics = {
				exerciseType: canonicalExercise.type,
				totalTests: authoritative.grading.totalTests,
				passedTests: authoritative.grading.passedTests,
				hintUsageCount: 0,
				submittedAt: attempt.endedAt,
				generatedCodeLength: attempt.generatedCode.length,
				importedFromGuest: {
					clientId: attempt.clientId,
					importedAt: Date.now()
				}
			};
			const analyticsJson = sanitizeAnalyticsJson(attempt.analyticsJson, analyticsDefaults).raw;

			const attemptActor = {
				userId: user.id,
				clientId: null,
				actorType: 'user' as const
			};
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

		if (values.length === 0) {
			return {
				success: true as const,
				importedCount: 0
			};
		}

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
			exerciseProgress: {},
			latestSnapshots: {}
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
	const latestSnapshots: Record<string, { workspaceXml: string; resultJson: string }> = {};

	for (const exerciseId of exerciseIds) {
		const exerciseAttempts = userAttempts.filter((a) => a.exerciseId === exerciseId);
		if (exerciseAttempts.length > 0) {
			const latestAttempt = exerciseAttempts[0];
			const bestScore = Math.max(...exerciseAttempts.map((a) => a.score));
			const hasPassed = exerciseAttempts.some((a) => a.passed);
			exerciseProgress[exerciseId] = {
				passed: hasPassed,
				bestScore,
				attemptCount: exerciseAttempts.length
			};
			latestSnapshots[exerciseId] = {
				workspaceXml: latestAttempt.workspaceXml,
				resultJson: latestAttempt.resultJson
			};
		}
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
 * Get aggregate analytics for a course (teacher/admin only).
 * Returns per-exercise stats: attempt count, unique students, pass rate, avg score.
 */
export const getCourseAnalytics = query(
	z.object({ courseId: z.string() }),
	async ({ courseId }) => {
		requireTeacherOrAdmin();

		const courseExerciseRelations = await db
			.select()
			.from(courseExercises)
			.where(eq(courseExercises.courseId, courseId))
			.orderBy(courseExercises.order);

		const exerciseIds = courseExerciseRelations.map((r) => r.exerciseId);

		if (exerciseIds.length === 0) {
			return {
				exerciseCount: 0,
				exercises: [],
				totals: {
					attempts: 0,
					students: 0,
					passRate: 0,
					avgScore: 0,
					avgWorkspaceBlockCount: 0,
					avgGeneratedCodeLength: 0,
					hintUsageCount: 0,
					avgDurationMs: 0,
					localeCounts: { de: 0, en: 0 }
				}
			};
		}

		const exerciseRows = await db.select().from(exercises);
		const exerciseMap = new Map(exerciseRows.map((e) => [e.id, e]));

		const allAttempts = await db.select().from(attempts);
		const allStudentIds = new Set<string>();
		let totalAttempts = 0;
		let totalPassed = 0;
		let totalScore = 0;
		let totalHintUsageCount = 0;
		let totalDurationMs = 0;
		let totalWorkspaceBlockCount = 0;
		let totalGeneratedCodeLength = 0;
		const totalLocaleCounts = { de: 0, en: 0 };

		const exerciseAnalytics = exerciseIds.map((exerciseId) => {
			const ex = exerciseMap.get(exerciseId);
			const title =
				ex?.content &&
				typeof ex.content === 'object' &&
				'title' in (ex.content as Record<string, unknown>)
					? ((ex.content as Record<string, unknown>).title as { de: string; en: string })
					: { de: exerciseId, en: exerciseId };

			const exAttempts = allAttempts.filter((a) => a.exerciseId === exerciseId);
			const studentIds = new Set(
				exAttempts.map((a) => a.userId ?? a.clientId ?? '').filter(Boolean)
			);
			studentIds.forEach((id) => allStudentIds.add(id));

			const passedCount = exAttempts.filter((a) => a.passed).length;
			const avgScore =
				exAttempts.length > 0
					? Math.round(exAttempts.reduce((sum, a) => sum + a.score, 0) / exAttempts.length)
					: 0;
			const hintUsageCount = exAttempts.reduce(
				(sum, attempt) => sum + countHintEvents(attempt.hintEventsJson),
				0
			);
			const analytics = exAttempts.map((attempt) =>
				parseAttemptAnalytics(attempt.analyticsJson, (ex?.type ?? 'io') as Exercise['type'])
			);
			const avgDurationMs =
				exAttempts.length > 0
					? Math.round(
							exAttempts.reduce(
								(sum, attempt) => sum + getAttemptDurationMs(attempt.startedAt, attempt.endedAt),
								0
							) / exAttempts.length
						)
					: 0;
			const localeCounts = exAttempts.reduce(
				(counts, attempt) => {
					counts[attempt.locale] += 1;
					return counts;
				},
				{ de: 0, en: 0 }
			);
			const avgWorkspaceBlockCount =
				exAttempts.length > 0
					? Math.round(
							analytics.reduce((sum, item) => sum + (item.workspaceBlockCount ?? 0), 0) /
								exAttempts.length
						)
					: 0;
			const avgGeneratedCodeLength =
				exAttempts.length > 0
					? Math.round(
							analytics.reduce((sum, item) => sum + (item.generatedCodeLength ?? 0), 0) /
								exAttempts.length
						)
					: 0;

			totalAttempts += exAttempts.length;
			totalPassed += passedCount;
			totalScore += exAttempts.reduce((sum, a) => sum + a.score, 0);
			totalHintUsageCount += hintUsageCount;
			totalDurationMs += exAttempts.reduce(
				(sum, attempt) => sum + getAttemptDurationMs(attempt.startedAt, attempt.endedAt),
				0
			);
			totalWorkspaceBlockCount += analytics.reduce(
				(sum, item) => sum + (item.workspaceBlockCount ?? 0),
				0
			);
			totalGeneratedCodeLength += analytics.reduce(
				(sum, item) => sum + (item.generatedCodeLength ?? 0),
				0
			);
			totalLocaleCounts.de += localeCounts.de;
			totalLocaleCounts.en += localeCounts.en;

			return {
				exerciseId,
				title,
				type: ex?.type ?? 'io',
				attempts: exAttempts.length,
				students: studentIds.size,
				passRate: exAttempts.length > 0 ? Math.round((passedCount / exAttempts.length) * 100) : 0,
				avgScore,
				avgWorkspaceBlockCount,
				avgGeneratedCodeLength,
				hintUsageCount,
				avgDurationMs,
				localeCounts
			};
		});

		return {
			exerciseCount: exerciseIds.length,
			exercises: exerciseAnalytics,
			totals: {
				attempts: totalAttempts,
				students: allStudentIds.size,
				passRate: totalAttempts > 0 ? Math.round((totalPassed / totalAttempts) * 100) : 0,
				avgScore: totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0,
				avgWorkspaceBlockCount:
					totalAttempts > 0 ? Math.round(totalWorkspaceBlockCount / totalAttempts) : 0,
				avgGeneratedCodeLength:
					totalAttempts > 0 ? Math.round(totalGeneratedCodeLength / totalAttempts) : 0,
				hintUsageCount: totalHintUsageCount,
				avgDurationMs: totalAttempts > 0 ? Math.round(totalDurationMs / totalAttempts) : 0,
				localeCounts: totalLocaleCounts
			}
		};
	}
);

/**
 * Export all attempts for a course as structured data (for CSV generation client-side).
 */
export const exportCourseAttempts = query(
	z.object({ courseId: z.string() }),
	async ({ courseId }) => {
		requireTeacherOrAdmin();

		const courseExerciseRelations = await db
			.select()
			.from(courseExercises)
			.where(eq(courseExercises.courseId, courseId))
			.orderBy(courseExercises.order);

		const exerciseIds = new Set(courseExerciseRelations.map((r) => r.exerciseId));

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
					durationMs: getAttemptDurationMs(a.startedAt, a.endedAt),
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
 * Export course attempts for thesis/evaluation work without raw user or attempt ids.
 */
export const exportCourseResearch = query(
	z.object({ courseId: z.string() }),
	async ({ courseId }) => {
		requireTeacherOrAdmin();

		const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
		if (!course) {
			error(404, 'Course not found');
		}

		const courseExerciseRelations = await db
			.select()
			.from(courseExercises)
			.where(eq(courseExercises.courseId, courseId))
			.orderBy(courseExercises.order);

		const exerciseIds = new Set(courseExerciseRelations.map((relation) => relation.exerciseId));
		const exerciseRows = (await db.select().from(exercises)).filter((exercise) =>
			exerciseIds.has(exercise.id)
		);
		const courseAttempts = (
			await db.select().from(attempts).orderBy(desc(attempts.createdAt))
		).filter((attempt) => exerciseIds.has(attempt.exerciseId));

		return createCourseResearchExport({
			course: {
				id: course.id,
				content: course.content
			},
			exercises: exerciseRows.map((exercise) => ({
				id: exercise.id,
				type: exercise.type,
				content: exercise.content
			})),
			attempts: courseAttempts
		});
	}
);

// =============================================================================
// Command Functions
// =============================================================================

export const createCourse = command(createCourseSchema, async (data) => {
	const user = requireTeacherOrAdmin();
	const { content, published, exerciseIds, userIds } = data;
	const targetPublished = published ?? false;

	const id = crypto.randomUUID();
	const now = Date.now();

	try {
		if (targetPublished) {
			const validationError = await validatePublishedCourseInput(content, exerciseIds);
			if (validationError) {
				return {
					success: false as const,
					error: validationError
				};
			}
		}

		// Insert course
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

		await writeAuditLog({
			actorUserId: user.id,
			action: 'course.create',
			details: { courseId: id, published: targetPublished }
		});

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
	const user = requireTeacherOrAdmin();
	const { id, content, published, exerciseIds, userIds } = data;
	const targetPublished = published ?? false;

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

		if (targetPublished) {
			const validationError = await validatePublishedCourseInput(content, exerciseIds);
			if (validationError) {
				return {
					success: false as const,
					error: validationError
				};
			}
		}

		// Update course
		await db
			.update(courses)
			.set({
				content,
				published: targetPublished,
				archivedAt: existing[0].archivedAt,
				archivedBy: existing[0].archivedBy,
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

		await writeAuditLog({
			actorUserId: user.id,
			action: 'course.update',
			details: { courseId: id, published: targetPublished }
		});

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
	const user = requireTeacherOrAdmin();

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
		await writeAuditLog({
			actorUserId: user.id,
			action: 'course.delete',
			details: { courseId: id }
		});

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

export const cloneCourse = command(courseCloneSchema, async ({ id }) => {
	const user = requireTeacherOrAdmin();

	try {
		const [existing] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
		if (!existing) {
			return { success: false as const, error: 'Course not found' };
		}

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
	} catch (e) {
		console.error('Error cloning course:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to clone course'
		};
	}
});

export const archiveCourse = command(courseArchiveSchema, async ({ id }) => {
	const user = requireTeacherOrAdmin();

	try {
		const [existing] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
		if (!existing) {
			return { success: false as const, error: 'Course not found' };
		}

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
	} catch (e) {
		console.error('Error archiving course:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to archive course'
		};
	}
});

export const restoreCourse = command(courseArchiveSchema, async ({ id }) => {
	const user = requireTeacherOrAdmin();

	try {
		const [existing] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
		if (!existing) {
			return { success: false as const, error: 'Course not found' };
		}

		await db
			.update(courses)
			.set({
				archivedAt: null,
				archivedBy: null,
				updatedAt: new Date()
			})
			.where(eq(courses.id, id));
		await writeAuditLog({
			actorUserId: user.id,
			action: 'course.restore',
			details: { courseId: id }
		});

		return { success: true as const };
	} catch (e) {
		console.error('Error restoring course:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to restore course'
		};
	}
});

export const exportCourse = query(z.object({ id: z.string() }), async ({ id }) => {
	requireTeacherOrAdmin();

	const [course] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
	if (!course) {
		error(404, 'Course not found');
	}

	const relations = await db
		.select()
		.from(courseExercises)
		.where(eq(courseExercises.courseId, id))
		.orderBy(courseExercises.order);

	const courseExerciseRows = await Promise.all(
		relations.map(async (relation) => {
			const [exercise] = await db
				.select()
				.from(exercises)
				.where(eq(exercises.id, relation.exerciseId))
				.limit(1);

			if (!exercise) {
				return null;
			}

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
		{
			id: course.id,
			content: course.content,
			published: course.published
		},
		courseExerciseRows.filter((row): row is NonNullable<typeof row> => Boolean(row))
	);
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
