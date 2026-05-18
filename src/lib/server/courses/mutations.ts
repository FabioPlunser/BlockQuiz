import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '$lib/server/db/client';
import {
	attempts,
	courseClasses,
	courseExercises,
	courseUsers,
	courses,
	exercises
} from '$lib/server/db/schema';
import { writeAuditLog } from '$lib/server/audit';
import { gradeExerciseAuthoritatively } from '$lib/server/authoritative-execution';
import { evaluateAndPersistBadges } from '$lib/server/badges/evaluate';
import { getEnrolledCourseIds } from '$lib/server/enrolment';
import { replaceCourseClasses } from '$lib/server/class-admin';
import {
	SubmittedResultValidationError,
	validateSubmittedVisibleResultShape
} from '$lib/attempts/submission';
import {
	canonicalizeExercise,
	dehydrateExercise
} from '$lib/types/exercise';
import {
	countHintEvents,
	sanitizeAnalyticsJson,
	sanitizeHintEventsJson,
	validatePublishedCourseInput
} from './helpers';
import type {
	courseArchiveSchema,
	courseCloneSchema,
	createCourseSchema,
	importCourseSchema,
	submitAttemptSchema,
	updateCourseSchema
} from './schemas';

type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
type CreateCourseInput = z.infer<typeof createCourseSchema>;
type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
type CourseCloneInput = z.infer<typeof courseCloneSchema>;
type CourseArchiveInput = z.infer<typeof courseArchiveSchema>;
type ImportCourseInput = z.infer<typeof importCourseSchema>;

/** Result envelope shared by every command — discriminated by `success`. */
type CommandResult<T = {}> =
	| ({ success: true } & T)
	| { success: false; error: string };

type AuthedUser = { id: string; email?: string | null };

// =============================================================================
// Attempt submission
// =============================================================================

export async function submitAttemptImpl(user: AuthedUser, data: SubmitAttemptInput) {
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

	const allowedCourseIds = await getEnrolledCourseIds(user.id);
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

	// Badges should only be awarded on the *first* passing attempt for a given
	// exercise. Resubmitting on an already-solved exercise should not award
	// perfect_score/no_hints/streak via easy wins.
	const previousPasses = await db
		.select({ id: attempts.id })
		.from(attempts)
		.where(
			and(
				eq(attempts.userId, user.id),
				eq(attempts.exerciseId, data.exerciseId),
				eq(attempts.passed, true)
			)
		)
		.limit(1);
	const alreadySolved = previousPasses.length > 0;

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

	const hintCount = countHintEvents(hintEventsJson);
	const newBadges = alreadySolved
		? []
		: await evaluateAndPersistBadges({
			userId: user.id,
			attemptSignal: {
				exerciseId: data.exerciseId,
				passed: authoritative.grading.passed,
				score: authoritative.grading.score,
				hintEventCount: hintCount,
				locale: data.locale
			},
			relatedCourseIds: relatedCourses.map((r) => r.courseId)
		});

	void writeAuditLog({
		actorUserId: user.id,
		action: 'attempt.submit',
		category: 'user',
		details: {
			attemptId: id,
			exerciseId: data.exerciseId,
			courseIds: relatedCourses.map((r) => r.courseId),
			passed: authoritative.grading.passed,
			score: authoritative.grading.score,
			hintUsageCount: hintCount,
			locale: data.locale,
			durationMs: endedAt - data.startedAt
		}
	});

	return {
		id,
		success: true as const,
		grading: authoritative.grading,
		resultJson: authoritative.resultJson,
		newBadges
	};
}

// =============================================================================
// Course CRUD
// =============================================================================

export async function createCourseImpl(
	user: AuthedUser,
	data: CreateCourseInput
): Promise<CommandResult<{ id: string }>> {
	const { content, published, exerciseIds, userIds, classIds } = data;
	const targetPublished = published ?? false;

	if (targetPublished) {
		const validationError = await validatePublishedCourseInput(content, exerciseIds);
		if (validationError) return { success: false, error: validationError };
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

		if (classIds.length > 0) {
			await replaceCourseClasses(db, id, classIds, user.id, now);
		}

		await writeAuditLog({
			actorUserId: user.id,
			action: 'course.create',
			category: 'admin',
			details: { courseId: id, published: targetPublished, classIds }
		});

		return { success: true, id };
	} catch (e) {
		console.error('Error creating course:', e);
		return {
			success: false,
			error: e instanceof Error ? e.message : 'Failed to create course'
		};
	}
}

export async function updateCourseImpl(
	user: AuthedUser,
	data: UpdateCourseInput
): Promise<CommandResult<{ id: string }>> {
	const { id, content, published, exerciseIds, userIds, classIds } = data;
	const targetPublished = published ?? false;
	const now = Date.now();

	const [existing] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
	if (!existing) return { success: false, error: 'Course not found' };

	if (targetPublished) {
		const validationError = await validatePublishedCourseInput(content, exerciseIds);
		if (validationError) return { success: false, error: validationError };
	}
	console.log('updateCourseImpl', { id, content, published: targetPublished, exerciseIds, userIds, classIds });

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

		await replaceCourseClasses(db, id, classIds, user.id, now);

		await writeAuditLog({
			actorUserId: user.id,
			action: 'course.update',
			category: 'admin',
			details: { courseId: id, published: targetPublished, classIds }
		});

		return { success: true, id };
	} catch (e) {
		console.error('Error updating course:', e);
		return {
			success: false,
			error: e instanceof Error ? e.message : 'Failed to update course'
		};
	}
}

export async function deleteCourseImpl(
	user: AuthedUser,
	id: string
): Promise<CommandResult> {
	const [existing] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
	if (!existing) return { success: false, error: 'Course not found' };

	await db.delete(courses).where(eq(courses.id, id));
	await writeAuditLog({
		actorUserId: user.id,
		action: 'course.delete',
		category: 'admin',
		details: { courseId: id }
	});
	return { success: true };
}

export async function cloneCourseImpl(
	user: AuthedUser,
	{ id }: CourseCloneInput
): Promise<CommandResult<{ id: string }>> {
	const [existing] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
	if (!existing) return { success: false, error: 'Course not found' };

	const relations = await db
		.select()
		.from(courseExercises)
		.where(eq(courseExercises.courseId, id))
		.orderBy(courseExercises.order);
	const userRelations = await db.select().from(courseUsers).where(eq(courseUsers.courseId, id));
	const classRelations = await db
		.select()
		.from(courseClasses)
		.where(eq(courseClasses.courseId, id));

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

	if (classRelations.length > 0) {
		await db.insert(courseClasses).values(
			classRelations.map((relation) => ({
				id: crypto.randomUUID(),
				courseId: cloneId,
				classId: relation.classId,
				addedBy: user.id,
				createdAt: now,
				updatedAt: now
			}))
		);
	}

	await writeAuditLog({
		actorUserId: user.id,
		action: 'course.clone',
		category: 'admin',
		details: { sourceCourseId: id, courseId: cloneId }
	});

	return { success: true, id: cloneId };
}

export async function archiveCourseImpl(
	user: AuthedUser,
	{ id }: CourseArchiveInput
): Promise<CommandResult> {
	const [existing] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
	if (!existing) return { success: false, error: 'Course not found' };

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
		category: 'admin',
		details: { courseId: id }
	});
	return { success: true };
}

export async function restoreCourseImpl(
	user: AuthedUser,
	{ id }: CourseArchiveInput
): Promise<CommandResult> {
	const [existing] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
	if (!existing) return { success: false, error: 'Course not found' };

	await db
		.update(courses)
		.set({ archivedAt: null, archivedBy: null, updatedAt: new Date() })
		.where(eq(courses.id, id));
	await writeAuditLog({
		actorUserId: user.id,
		action: 'course.restore',
		category: 'admin',
		details: { courseId: id }
	});
	return { success: true };
}

export async function importCourseImpl(
	user: AuthedUser,
	{ payload }: ImportCourseInput
): Promise<CommandResult<{ id: string }>> {
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
			category: 'admin',
			details: { courseId, exerciseCount: payload.exercises.length }
		});

		return { success: true, id: courseId };
	} catch (e) {
		console.error('Error importing course:', e);
		return {
			success: false,
			error: e instanceof Error ? e.message : 'Failed to import course'
		};
	}
}
