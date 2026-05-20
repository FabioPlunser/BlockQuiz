import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { command, query, requested } from '$app/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import {
	courseExercises,
	courses,
	exercises,
	exerciseVersions,
	user
} from '$lib/server/db/schema';
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

// `courseId` is optional now: a freshly-created exercise can live in zero
// courses and be assigned later via the courses editor. When provided we
// also insert a `courseExercises` row so the exercise immediately shows up
// in that course.
const createExerciseSchema = z.object({
	courseId: z.string().optional(),
	type: z.enum(['io', 'turtle', 'robot']),
	content: z.unknown(),
	config: z.unknown(),
	published: z.boolean().optional().default(false),
	order: z.number().optional().default(0)
});

// updateExercise no longer accepts courseId — course membership is managed
// in the course editor through `courseExercises` directly.
const updateExerciseSchema = z.object({
	id: z.string(),
	type: z.enum(['io', 'turtle', 'robot']).optional(),
	content: z.unknown().optional(),
	config: z.unknown().optional(),
	published: z.boolean().optional(),
	order: z.number().optional()
});

const cloneExerciseSchema = z.object({
	id: z.string(),
	// Optional: also attach the clone to this course on creation.
	courseId: z.string().optional()
});

const exerciseArchiveSchema = z.object({
	id: z.string()
});

const restoreExerciseVersionSchema = z.object({
	exerciseId: z.string(),
	versionId: z.string()
});

const exerciseVersionSnapshotSchema = z.object({
	schemaVersion: z.literal(1),
	exercise: z.object({
		// `courseId` was part of old snapshots; tolerate it on read, never write it.
		courseId: z.string().optional(),
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

/**
 * Walk two snapshot objects in parallel and return a flat list of dot-paths
 * whose values differ. Used by the version-history panel to show "what
 * changed" between adjacent versions without a heavy diff library.
 */
function diffSnapshots(
	prev: unknown,
	next: unknown,
	prefix = '',
	out: string[] = []
): string[] {
	if (prev === next) return out;
	if (prev == null || next == null) {
		if (prefix) out.push(prefix);
		return out;
	}
	if (typeof prev !== 'object' || typeof next !== 'object') {
		if (prev !== next && prefix) out.push(prefix);
		return out;
	}
	const a = prev as Record<string, unknown>;
	const b = next as Record<string, unknown>;
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const key of keys) {
		const path = prefix ? `${prefix}.${key}` : key;
		diffSnapshots(a[key], b[key], path, out);
	}
	return out;
}

function formatPublishValidationError(exercise: Exercise) {
	return exercise.validation.issues.map((issue) => issue.message).join(' ');
}

async function createExerciseVersion(
	exercise: Exercise,
	options: { createdBy: string; message: string }
) {
	const snapshot = createExerciseVersionSnapshotPayload(exercise);

	// Skip if the latest version's snapshot is byte-identical — nothing
	// changed, so a new history entry would just be noise.
	const [latest] = await db
		.select({ snapshotJson: exerciseVersions.snapshotJson })
		.from(exerciseVersions)
		.where(eq(exerciseVersions.exerciseId, exercise.id))
		.orderBy(desc(exerciseVersions.createdAt))
		.limit(1);
	if (latest && latest.snapshotJson === snapshot) return;

	await db.insert(exerciseVersions).values({
		id: crypto.randomUUID(),
		exerciseId: exercise.id,
		snapshotJson: snapshot,
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
			type: exercise.type,
			image: exercise.content.image ?? '',
			content: persisted.content,
			config: persisted.config,
			validationJson: exercise.validation,
			published: exercise.published,
			archivedAt: exercise.archivedAt ?? null,
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

/**
 * Inserts a `courseExercises` bridge row, appending the exercise to the end
 * of the course's exercise order. No-op when the membership already exists.
 */
async function attachExerciseToCourse(exerciseId: string, courseId: string) {
	const [existing] = await db
		.select()
		.from(courseExercises)
		.where(
			and(
				eq(courseExercises.exerciseId, exerciseId),
				eq(courseExercises.courseId, courseId)
			)
		)
		.limit(1);
	if (existing) return;

	const siblings = await db
		.select({ order: courseExercises.order })
		.from(courseExercises)
		.where(eq(courseExercises.courseId, courseId));
	const nextOrder = siblings.reduce((max, row) => Math.max(max, row.order), -1) + 1;

	const now = Date.now();
	await db.insert(courseExercises).values({
		id: crypto.randomUUID(),
		courseId,
		exerciseId,
		order: nextOrder,
		createdAt: now,
		updatedAt: now
	});
}

export const getExercises = query(exerciseFilterSchema, async (filters) => {
	requireTeacherOrAdmin();

	// When filtering by course, scope to the exercises that course owns via
	// the M:N bridge.
	let allowedIds: Set<string> | null = null;
	if (filters.courseId) {
		const rows = await db
			.select({ exerciseId: courseExercises.exerciseId })
			.from(courseExercises)
			.where(eq(courseExercises.courseId, filters.courseId));
		allowedIds = new Set(rows.map((row) => row.exerciseId));
		if (allowedIds.size === 0) return [];
	}

	const rows = await db.select().from(exercises);
	return rows
		.filter((row) => {
			if (allowedIds && !allowedIds.has(row.id)) return false;
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
			.select({
				exercise: exercises,
				order: courseExercises.order
			})
			.from(courseExercises)
			.innerJoin(exercises, eq(exercises.id, courseExercises.exerciseId))
			.where(eq(courseExercises.courseId, courseId))
			.orderBy(courseExercises.order);

		return rows.map((row) => hydrateExerciseRow(row.exercise));
	}
);

export const createExercise = command(createExerciseSchema, async (data) => {
	const user = requireTeacherOrAdmin();
	const id = crypto.randomUUID();
	const now = Date.now();

	try {
		if (data.courseId) {
			await ensureCourseExists(data.courseId);
		}
		await insertExerciseFromInput(
			{
				id,
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
		if (data.courseId) {
			await attachExerciseToCourse(id, data.courseId);
		}
		await writeAuditLog({
			actorUserId: user.id,
			action: 'exercise.create',
			details: {
				exerciseId: id,
				courseId: data.courseId ?? null,
				type: data.type,
				published: data.published ?? false
			}
		});
		await requested(getExercises, 10).refreshAll();

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

		await updateExerciseFromInput(
			data.id,
			{
				...existing,
				content: data.content ?? existing.content,
				config: data.config ?? existing.config,
				id: data.id,
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
				type: data.type ?? existing.type,
				published: data.published ?? existing.published
			}
		});
		await requested(getExercises, 10).refreshAll();

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
		if (courseId) {
			await ensureCourseExists(courseId);
		}

		const clone = await insertExerciseFromInput(
			{
				...existing,
				id: crypto.randomUUID(),
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

		// Mirror the source's course memberships so the clone shows up in the
		// same courses (or just `courseId` if provided).
		const memberships = courseId
			? [courseId]
			: (
					await db
						.select({ courseId: courseExercises.courseId })
						.from(courseExercises)
						.where(eq(courseExercises.exerciseId, existing.id))
				).map((row) => row.courseId);
		for (const target of memberships) {
			await attachExerciseToCourse(clone.id, target);
		}

		await writeAuditLog({
			actorUserId: user.id,
			action: 'exercise.clone',
			details: {
				sourceExerciseId: id,
				exerciseId: clone.id,
				courseIds: memberships
			}
		});
		await requested(getExercises, 10).refreshAll();

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
			details: { exerciseId: id }
		});
		await requested(getExercises, 10).refreshAll();

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
			details: { exerciseId: id }
		});
		await requested(getExercises, 10).refreshAll();

		return { success: true as const };
	} catch (cause) {
		console.error('Error restoring exercise:', cause);
		return {
			success: false as const,
			error: cause instanceof Error ? cause.message : 'Failed to restore exercise'
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

		// Pre-compute snapshot parses + the change-set vs the previous (older)
		// version. Returning rows ordered newest-first; "previous" is the next
		// item in the array.
		const parsedRows = rows.map((row) => {
			const parsed = exerciseVersionSnapshotSchema.safeParse(JSON.parse(row.snapshotJson));
			return {
				row,
				snapshot: parsed.success ? parsed.data.exercise : null
			};
		});

		return parsedRows.map((entry, index) => {
			const prev = parsedRows[index + 1]?.snapshot ?? null;
			return {
				id: entry.row.id,
				message: entry.row.message,
				createdBy: entry.row.createdBy,
				createdAt: entry.row.createdAt,
				type: entry.snapshot?.type ?? null,
				published: entry.snapshot?.published ?? null,
				title: entry.snapshot?.content ?? null,
				changes: diffSnapshots(prev, entry.snapshot)
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
			await requested(getExercises, 10).refreshAll();

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

// Reassign an exercise's author. exercises.created_by is a FK to user.id, so
// we store the target user's id directly. Any teacher/admin can reassign.
export const setExerciseAuthor = command(
	z.object({ exerciseId: z.string().min(1), userId: z.string().min(1) }),
	async ({ exerciseId, userId }) => {
		const actor = requireTeacherOrAdmin();

		const [target] = await db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		if (!target) return { success: false as const, error: 'Target user not found' };

		const [existing] = await db
			.select({ id: exercises.id, createdBy: exercises.createdBy })
			.from(exercises)
			.where(eq(exercises.id, exerciseId))
			.limit(1);
		if (!existing) return { success: false as const, error: 'Exercise not found' };

		await db
			.update(exercises)
			.set({ createdBy: userId, updatedAt: Date.now() })
			.where(eq(exercises.id, exerciseId));

		await writeAuditLog({
			actorUserId: actor.id,
			action: 'exercise.author.set',
			category: 'admin',
			details: {
				exerciseId,
				previousCreatedBy: existing.createdBy,
				newAuthorUserId: userId
			}
		});
		return { success: true as const };
	}
);

export const deleteExercise = command(z.string(), async (id) => {
	requireTeacherOrAdmin();

	try {
		await ensureExerciseExists(id);
		await db.delete(exercises).where(eq(exercises.id, id));
		await db.delete(courseExercises).where(eq(courseExercises.exerciseId, id));
		await requested(getExercises, 10).refreshAll();

		return { success: true as const };
	} catch (cause) {
		console.error('Error deleting exercise:', cause);
		return {
			success: false as const,
			error: cause instanceof Error ? cause.message : 'Failed to delete exercise'
		};
	}
});
