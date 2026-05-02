import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { command, query } from '$app/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import { courseExercises, courses, exercises, exerciseVersions } from '$lib/server/db/schema';
import { createExerciseTransfer, exerciseTransferSchema } from '$lib/import-export/transfers';
import {
	canonicalizeExercise,
	dehydrateExercise,
	validateExercise,
	dbExerciseTypes,
	type Exercise,
	type ExerciseType
} from '$lib/types/exercise';
import { requireTeacherOrAdmin } from '$lib/utils/requireAuth';
import { writeAuditLog } from '$lib/server/audit';

const exerciseFilterSchema = z.object({
	courseId: z.string().optional(),
	type: z.enum(dbExerciseTypes).optional(),
	published: z.boolean().optional(),
	archived: z.boolean().optional()
});

const createExerciseSchema = z.object({
	courseId: z.string(),
	type: z.enum(['io', 'turtle', 'robot']),
	content: z.unknown(),
	config: z.unknown(),
	published: z.boolean().optional().default(false),
	order: z.number().optional().default(0)
});

const updateExerciseSchema = createExerciseSchema.partial().extend({
	id: z.string()
});

const cloneExerciseSchema = z.object({
	id: z.string(),
	courseId: z.string().optional()
});

const exerciseArchiveSchema = z.object({
	id: z.string()
});

const importExerciseSchema = z.object({
	courseId: z.string(),
	payload: exerciseTransferSchema
});

const restoreExerciseVersionSchema = z.object({
	exerciseId: z.string(),
	versionId: z.string()
});

const exerciseVersionSnapshotSchema = z.object({
	schemaVersion: z.literal(1),
	exercise: z.object({
		courseId: z.string(),
		type: z.enum(['io', 'turtle', 'robot']),
		content: z.unknown(),
		config: z.unknown(),
		published: z.boolean(),
		order: z.number(),
		archivedAt: z.number().nullable().optional(),
		archivedBy: z.string().nullable().optional()
	})
});

function hydrateExerciseRow(row: typeof exercises.$inferSelect): Exercise {
	return canonicalizeExercise({
		...row,
		content: row.content,
		config: row.config,
		validationJson: row.validationJson,
		image: row.image,
		archivedAt: row.archivedAt,
		archivedBy: row.archivedBy
	});
}

function createExerciseVersionSnapshotPayload(exercise: Exercise) {
	return JSON.stringify({
		schemaVersion: 1,
		exercise: {
			courseId: exercise.courseId,
			type: exercise.type,
			content: exercise.content,
			config: exercise.config,
			published: exercise.published,
			order: exercise.order,
			archivedAt: exercise.archivedAt ?? null,
			archivedBy: exercise.archivedBy ?? null
		}
	});
}

function formatPublishValidationError(exercise: Exercise) {
	return exercise.validation.issues.map((issue) => issue.message).join(' ');
}

async function createExerciseVersion(
	exercise: Exercise,
	options: { createdBy: string; message: string }
) {
	await db.insert(exerciseVersions).values({
		id: crypto.randomUUID(),
		exerciseId: exercise.id,
		snapshotJson: createExerciseVersionSnapshotPayload(exercise),
		message: options.message,
		createdBy: options.createdBy,
		createdAt: Date.now()
	});
}

async function ensureCourseExists(courseId: string) {
	const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
	if (!course) {
		error(404, 'Course not found');
	}

	return course;
}

async function ensureExerciseExists(id: string) {
	const [row] = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1);
	if (!row) {
		error(404, 'Exercise not found');
	}

	return row;
}

async function insertExerciseFromInput(
	input: Parameters<typeof dehydrateExercise>[0],
	options: { versionMessage: string; versionAuthor: string }
) {
	const persisted = dehydrateExercise(input);
	const validation = validateExercise(persisted.exercise);
	const exercise = {
		...persisted.exercise,
		validation
	};

	if (exercise.published && !exercise.validation.valid) {
		throw new Error(
			`Cannot publish exercise until validation passes. ${formatPublishValidationError(exercise)}`
		);
	}

	await db.insert(exercises).values({
		id: exercise.id,
		courseId: exercise.courseId,
		type: exercise.type,
		image: exercise.content.image ?? '',
		content: persisted.content,
		config: persisted.config,
		validationJson: exercise.validation,
		published: exercise.published,
		archivedAt: exercise.archivedAt ?? null,
		archivedBy: exercise.archivedBy ?? null,
		order: exercise.order,
		createdBy: exercise.createdBy,
		createdAt: exercise.createdAt,
		updatedAt: exercise.updatedAt
	});

	await createExerciseVersion(exercise, {
		createdBy: options.versionAuthor,
		message: options.versionMessage
	});

	return exercise;
}

async function updateExerciseFromInput(
	id: string,
	input: Parameters<typeof dehydrateExercise>[0],
	options: { versionMessage: string; versionAuthor: string }
) {
	const persisted = dehydrateExercise(input);
	const validation = validateExercise(persisted.exercise);
	const exercise = {
		...persisted.exercise,
		validation
	};

	if (exercise.published && !exercise.validation.valid) {
		throw new Error(
			`Cannot publish exercise until validation passes. ${formatPublishValidationError(exercise)}`
		);
	}

	await db
		.update(exercises)
		.set({
			courseId: exercise.courseId,
			type: exercise.type,
			image: exercise.content.image ?? '',
			content: persisted.content,
			config: persisted.config,
			validationJson: exercise.validation,
			published: exercise.published,
			archivedAt: exercise.archivedAt ?? null,
			archivedBy: exercise.archivedBy ?? null,
			order: exercise.order,
			updatedAt: exercise.updatedAt
		})
		.where(eq(exercises.id, id));

	await createExerciseVersion(exercise, {
		createdBy: options.versionAuthor,
		message: options.versionMessage
	});

	return exercise;
}

export const getExercises = query(exerciseFilterSchema, async (filters) => {
	requireTeacherOrAdmin();
	const rows = await db.select().from(exercises);
	return rows
		.filter((row) => {
			if (filters.courseId && row.courseId !== filters.courseId) return false;
			if (filters.type && filters.type !== 'all' && row.type !== filters.type) return false;
			if (filters.published !== undefined && row.published !== filters.published) return false;
			if (filters.archived !== undefined) {
				return filters.archived ? row.archivedAt != null : row.archivedAt == null;
			}
			return true;
		})
		.map((row) => hydrateExerciseRow(row));
});

export const getExercise = query(z.object({ id: z.string() }), async ({ id }) => {
	requireTeacherOrAdmin();
	return hydrateExerciseRow(await ensureExerciseExists(id));
});

export const getExercisesByCourse = query(
	z.object({ courseId: z.string() }),
	async ({ courseId }) => {
		requireTeacherOrAdmin();
		await ensureCourseExists(courseId);

		const rows = await db
			.select()
			.from(exercises)
			.where(eq(exercises.courseId, courseId))
			.orderBy(exercises.order);

		return rows.map((row) => hydrateExerciseRow(row));
	}
);

export const createExercise = command(createExerciseSchema, async (data) => {
	const user = requireTeacherOrAdmin();
	const id = crypto.randomUUID();
	const now = Date.now();

	try {
		await ensureCourseExists(data.courseId);
		await insertExerciseFromInput(
			{
				id,
				courseId: data.courseId,
				type: data.type,
				content: data.content,
				config: data.config,
				published: data.published ?? false,
				order: data.order ?? 0,
				createdBy: user.id,
				createdAt: now,
				updatedAt: now,
				archivedAt: null,
				archivedBy: null
			},
			{ versionAuthor: user.id, versionMessage: 'Created exercise' }
		);
		await writeAuditLog({
			actorUserId: user.id,
			action: 'exercise.create',
			details: {
				exerciseId: id,
				courseId: data.courseId,
				type: data.type,
				published: data.published ?? false
			}
		});

		return { success: true as const, id };
	} catch (cause) {
		console.error('Error creating exercise:', cause);
		return {
			success: false as const,
			error: cause instanceof Error ? cause.message : 'Failed to create exercise'
		};
	}
});

export const updateExercise = command(updateExerciseSchema, async (data) => {
	const user = requireTeacherOrAdmin();

	try {
		const existing = await ensureExerciseExists(data.id);
		const targetCourseId = data.courseId ?? existing.courseId;
		await ensureCourseExists(targetCourseId);

		await updateExerciseFromInput(
			data.id,
			{
				...existing,
				content: data.content ?? existing.content,
				config: data.config ?? existing.config,
				id: data.id,
				courseId: targetCourseId,
				type: data.type ?? existing.type,
				published: data.published ?? existing.published,
				order: data.order ?? existing.order,
				createdBy: existing.createdBy,
				createdAt: existing.createdAt,
				updatedAt: Date.now(),
				image: existing.image,
				archivedAt: existing.archivedAt,
				archivedBy: existing.archivedBy
			},
			{ versionAuthor: user.id, versionMessage: 'Saved changes' }
		);
		await writeAuditLog({
			actorUserId: user.id,
			action: 'exercise.update',
			details: {
				exerciseId: data.id,
				courseId: targetCourseId,
				type: data.type ?? existing.type,
				published: data.published ?? existing.published
			}
		});

		return { success: true as const, id: data.id };
	} catch (cause) {
		console.error('Error updating exercise:', cause);
		return {
			success: false as const,
			error: cause instanceof Error ? cause.message : 'Failed to update exercise'
		};
	}
});

export const cloneExercise = command(cloneExerciseSchema, async ({ id, courseId }) => {
	const user = requireTeacherOrAdmin();

	try {
		const existing = hydrateExerciseRow(await ensureExerciseExists(id));
		const targetCourseId = courseId ?? existing.courseId;
		await ensureCourseExists(targetCourseId);

		const clone = await insertExerciseFromInput(
			{
				...existing,
				id: crypto.randomUUID(),
				courseId: targetCourseId,
				published: false,
				order: existing.order + 1,
				createdBy: user.id,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				archivedAt: null,
				archivedBy: null
			},
			{ versionAuthor: user.id, versionMessage: `Cloned from ${existing.id}` }
		);
		await writeAuditLog({
			actorUserId: user.id,
			action: 'exercise.clone',
			details: { sourceExerciseId: id, exerciseId: clone.id, courseId: targetCourseId }
		});

		return { success: true as const, id: clone.id };
	} catch (cause) {
		console.error('Error cloning exercise:', cause);
		return {
			success: false as const,
			error: cause instanceof Error ? cause.message : 'Failed to clone exercise'
		};
	}
});

export const archiveExercise = command(exerciseArchiveSchema, async ({ id }) => {
	const user = requireTeacherOrAdmin();

	try {
		const existing = hydrateExerciseRow(await ensureExerciseExists(id));
		await updateExerciseFromInput(
			id,
			{
				...existing,
				published: false,
				updatedAt: Date.now(),
				archivedAt: Date.now(),
				archivedBy: user.id
			},
			{ versionAuthor: user.id, versionMessage: 'Archived exercise' }
		);
		await writeAuditLog({
			actorUserId: user.id,
			action: 'exercise.archive',
			details: { exerciseId: id, courseId: existing.courseId }
		});

		return { success: true as const };
	} catch (cause) {
		console.error('Error archiving exercise:', cause);
		return {
			success: false as const,
			error: cause instanceof Error ? cause.message : 'Failed to archive exercise'
		};
	}
});

export const restoreExercise = command(exerciseArchiveSchema, async ({ id }) => {
	const user = requireTeacherOrAdmin();

	try {
		const existing = hydrateExerciseRow(await ensureExerciseExists(id));
		await updateExerciseFromInput(
			id,
			{
				...existing,
				updatedAt: Date.now(),
				archivedAt: null,
				archivedBy: null
			},
			{ versionAuthor: user.id, versionMessage: 'Restored exercise' }
		);
		await writeAuditLog({
			actorUserId: user.id,
			action: 'exercise.restore',
			details: { exerciseId: id, courseId: existing.courseId }
		});

		return { success: true as const };
	} catch (cause) {
		console.error('Error restoring exercise:', cause);
		return {
			success: false as const,
			error: cause instanceof Error ? cause.message : 'Failed to restore exercise'
		};
	}
});

export const exportExercise = query(z.object({ id: z.string() }), async ({ id }) => {
	requireTeacherOrAdmin();
	const exercise = hydrateExerciseRow(await ensureExerciseExists(id));

	return createExerciseTransfer(exercise);
});

export const importExercise = command(importExerciseSchema, async ({ courseId, payload }) => {
	const user = requireTeacherOrAdmin();

	try {
		await ensureCourseExists(courseId);
		const imported = await insertExerciseFromInput(
			{
				id: crypto.randomUUID(),
				courseId,
				type: payload.exercise.type,
				content: payload.exercise.content,
				config: payload.exercise.config,
				published: false,
				order: payload.exercise.order,
				createdBy: user.id,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				archivedAt: null,
				archivedBy: null
			},
			{ versionAuthor: user.id, versionMessage: 'Imported exercise' }
		);
		await writeAuditLog({
			actorUserId: user.id,
			action: 'exercise.import',
			details: { exerciseId: imported.id, courseId, type: payload.exercise.type }
		});

		return { success: true as const, id: imported.id };
	} catch (cause) {
		console.error('Error importing exercise:', cause);
		return {
			success: false as const,
			error: cause instanceof Error ? cause.message : 'Failed to import exercise'
		};
	}
});

export const getExerciseVersions = query(
	z.object({ exerciseId: z.string() }),
	async ({ exerciseId }) => {
		requireTeacherOrAdmin();
		await ensureExerciseExists(exerciseId);

		const rows = await db
			.select()
			.from(exerciseVersions)
			.where(eq(exerciseVersions.exerciseId, exerciseId))
			.orderBy(desc(exerciseVersions.createdAt));

		return rows.map((row) => {
			const parsed = exerciseVersionSnapshotSchema.safeParse(JSON.parse(row.snapshotJson));
			const snapshot = parsed.success ? parsed.data.exercise : null;

			return {
				id: row.id,
				message: row.message,
				createdBy: row.createdBy,
				createdAt: row.createdAt,
				type: snapshot?.type ?? null,
				published: snapshot?.published ?? null,
				title: snapshot?.content ?? null
			};
		});
	}
);

export const restoreExerciseVersion = command(
	restoreExerciseVersionSchema,
	async ({ exerciseId, versionId }) => {
		const user = requireTeacherOrAdmin();

		try {
			const existing = await ensureExerciseExists(exerciseId);
			const [version] = await db
				.select()
				.from(exerciseVersions)
				.where(and(eq(exerciseVersions.id, versionId), eq(exerciseVersions.exerciseId, exerciseId)))
				.limit(1);

			if (!version) {
				return {
					success: false as const,
					error: 'Exercise version not found'
				};
			}

			const parsed = exerciseVersionSnapshotSchema.safeParse(JSON.parse(version.snapshotJson));
			if (!parsed.success) {
				return {
					success: false as const,
					error: 'Stored exercise version is invalid'
				};
			}

			await updateExerciseFromInput(
				exerciseId,
				{
					...existing,
					id: exerciseId,
					courseId: parsed.data.exercise.courseId,
					type: parsed.data.exercise.type as ExerciseType,
					content: parsed.data.exercise.content,
					config: parsed.data.exercise.config,
					published: parsed.data.exercise.published,
					order: parsed.data.exercise.order,
					updatedAt: Date.now(),
					archivedAt: parsed.data.exercise.archivedAt ?? null,
					archivedBy: parsed.data.exercise.archivedBy ?? null
				},
				{ versionAuthor: user.id, versionMessage: `Restored version ${versionId}` }
			);

			return { success: true as const, id: exerciseId };
		} catch (cause) {
			console.error('Error restoring exercise version:', cause);
			return {
				success: false as const,
				error: cause instanceof Error ? cause.message : 'Failed to restore exercise version'
			};
		}
	}
);

export const deleteExercise = command(z.string(), async (id) => {
	requireTeacherOrAdmin();

	try {
		await ensureExerciseExists(id);
		await db.delete(exercises).where(eq(exercises.id, id));
		await db.delete(courseExercises).where(eq(courseExercises.exerciseId, id));

		return { success: true as const };
	} catch (cause) {
		console.error('Error deleting exercise:', cause);
		return {
			success: false as const,
			error: cause instanceof Error ? cause.message : 'Failed to delete exercise'
		};
	}
});
