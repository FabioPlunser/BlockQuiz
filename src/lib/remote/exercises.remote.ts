import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { command, query } from '$app/server';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import { courseExercises, courses, exercises } from '$lib/server/db/schema';
import {
	canonicalizeExercise,
	dbExerciseTypes,
	dehydrateExercise,
	type Exercise
} from '$lib/types/exercise';
import { requireTeacherOrAdmin } from '$lib/utils/requireAuth';

const exerciseFilterSchema = z.object({
	courseId: z.string().optional(),
	type: z.enum(dbExerciseTypes).optional(),
	published: z.boolean().optional()
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

function hydrateExerciseRow(row: typeof exercises.$inferSelect): Exercise {
	return canonicalizeExercise({
		...row,
		content: row.content,
		config: row.config,
		validationJson: row.validationJson,
		image: row.image
	});
}

export const getExercises = query(exerciseFilterSchema, async (filters) => {
	requireTeacherOrAdmin();
	const conditions = [];

	if (filters.courseId) {
		conditions.push(eq(exercises.courseId, filters.courseId));
	}
	if (filters.type && filters.type !== 'all') {
		conditions.push(eq(exercises.type, filters.type));
	}
	if (filters.published !== undefined) {
		conditions.push(eq(exercises.published, filters.published));
	}

	const rows =
		conditions.length === 0
			? await db.select().from(exercises)
			: await db
					.select()
					.from(exercises)
					.where(conditions.length === 1 ? conditions[0] : and(...conditions));

	return rows.map((row) => hydrateExerciseRow(row));
});

export const getExercise = query(z.object({ id: z.string() }), async ({ id }) => {
	requireTeacherOrAdmin();
	const [row] = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1);

	if (!row) {
		error(404, 'Exercise not found');
	}

	return hydrateExerciseRow(row);
});

export const getExercisesByCourse = query(z.object({ courseId: z.string() }), async ({ courseId }) => {
	requireTeacherOrAdmin();
	const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);

	if (!course) {
		error(404, 'Course not found');
	}

	const rows = await db
		.select()
		.from(exercises)
		.where(eq(exercises.courseId, courseId))
		.orderBy(exercises.order);

	return rows.map((row) => hydrateExerciseRow(row));
});

export const createExercise = command(createExerciseSchema, async (data) => {
	const user = requireTeacherOrAdmin();
	const id = crypto.randomUUID();
	const now = Date.now();
	const persisted = dehydrateExercise({
		id,
		courseId: data.courseId,
		type: data.type,
		content: data.content,
		config: data.config,
		published: data.published ?? false,
		order: data.order ?? 0,
		createdBy: user.id,
		createdAt: now,
		updatedAt: now
	});

	try {
		await db.insert(exercises).values({
			id: persisted.exercise.id,
			courseId: persisted.exercise.courseId,
			type: persisted.exercise.type,
			image: persisted.exercise.content.image ?? '',
			content: persisted.content,
			config: persisted.config,
			validationJson: persisted.validation,
			published: persisted.exercise.published,
			order: persisted.exercise.order,
			createdBy: persisted.exercise.createdBy,
			createdAt: persisted.exercise.createdAt,
			updatedAt: persisted.exercise.updatedAt
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
	requireTeacherOrAdmin();

	try {
		const [existing] = await db.select().from(exercises).where(eq(exercises.id, data.id)).limit(1);

		if (!existing) {
			return {
				success: false as const,
				error: 'Exercise not found'
			};
		}

		const persisted = dehydrateExercise({
			...existing,
			content: data.content ?? existing.content,
			config: data.config ?? existing.config,
			validationJson: existing.validationJson,
			id: data.id,
			courseId: data.courseId ?? existing.courseId,
			type: data.type ?? existing.type,
			published: data.published ?? existing.published,
			order: data.order ?? existing.order,
			createdBy: existing.createdBy,
			createdAt: existing.createdAt,
			updatedAt: Date.now(),
			image: existing.image
		});

		await db
			.update(exercises)
			.set({
				courseId: persisted.exercise.courseId,
				type: persisted.exercise.type,
				image: persisted.exercise.content.image ?? '',
				content: persisted.content,
				config: persisted.config,
				validationJson: persisted.validation,
				published: persisted.exercise.published,
				order: persisted.exercise.order,
				updatedAt: persisted.exercise.updatedAt
			})
			.where(eq(exercises.id, data.id));

		return { success: true as const, id: data.id };
	} catch (cause) {
		console.error('Error updating exercise:', cause);
		return {
			success: false as const,
			error: cause instanceof Error ? cause.message : 'Failed to update exercise'
		};
	}
});

export const deleteExercise = command(z.string(), async (id) => {
	requireTeacherOrAdmin();

	try {
		const [existing] = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1);

		if (!existing) {
			return {
				success: false as const,
				error: 'Exercise not found'
			};
		}

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
