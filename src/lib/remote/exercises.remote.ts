import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, command } from '$app/server';
import { db } from '$lib/server/db/client';
import { exercises, courses } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import {
	type ExerciseContent,
	type ExerciseConfig,
	dbExerciseTypes
} from '$lib/types/exercise';
import { requireTeacherOrAdmin } from '$lib/utils/requireAuth';
import type { Exercise } from '$lib/types/exercise';

// =============================================================================
// Zod Schemas
// =============================================================================

const localizedStringSchema = z.object({
	de: z.string(),
	en: z.string()
});

const hintSchema = z.object({
	id: z.string(),
	text: localizedStringSchema,
	trigger: z.enum(['click', 'time']),
	delaySeconds: z.number().optional()
});

const testCaseSchema = z.object({
	id: z.string(),
	description: localizedStringSchema,
	visible: z.boolean(),
	type: z.enum(['target', 'commands', 'state', 'path']),
	message: localizedStringSchema.optional(),
	expected: z.object({
		target: z
			.object({
				x: z.number(),
				y: z.number(),
				tolerance: z.number().optional()
			})
			.optional(),
		commands: z.array(z.string()).optional(),
		state: z
			.object({
				x: z.number(),
				y: z.number(),
				angle: z.number(),
				tolerance: z.number()
			})
			.optional(),
		path: z
			.array(
				z.object({
					x: z.number(),
					y: z.number()
				})
			)
			.optional()
	})
});

const exerciseContentSchema = z.object({
	title: localizedStringSchema,
	description: localizedStringSchema,
	image: z.string().optional(),
	example: z
		.object({
			description: localizedStringSchema,
			starterXml: z.string(),
			explanation: localizedStringSchema
		})
		.optional()
});

const exerciseConfigSchema = z.object({
	mode: z.enum(['default', 'path', 'apple']),
	toolbox: z.array(z.string()),
	starterXml: z.string(),
	hasStarterBlocks: z.boolean(),
	canvas: z.object({
		width: z.number(),
		height: z.number(),
		gridSize: z.number(),
		pathOverlay: z.array(z.object({ x: z.number(), y: z.number() })),
		targets: z.array(
			z.object({
				x: z.number(),
				y: z.number(),
				tolerance: z.number().optional(),
				icon: z.enum(['apple', 'flag', 'star', 'custom']).optional()
			})
		),
		walls: z.array(z.object({ x: z.number(), y: z.number() }))
	}),
	grader: z.object({
		appleTolerance: z.number(),
		wallTolerance: z.number(),
		testCases: z.array(testCaseSchema)
	}),
	hints: z.array(hintSchema)
});

const exerciseFilterSchema = z.object({
	courseId: z.string().optional(),
	type: z.enum(dbExerciseTypes).optional(),
	published: z.boolean().optional()
});

const createExerciseSchema = z.object({
	courseId: z.string().optional(),
	type: z.enum(['io', 'turtle', 'robot']),
	content: exerciseContentSchema,
	config: exerciseConfigSchema,
	published: z.boolean().optional().default(false),
	order: z.number().optional().default(0)
});

const updateExerciseSchema = createExerciseSchema.partial().extend({
	id: z.string()
});

// =============================================================================
// Query Functions
// =============================================================================

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

	if (conditions.length === 0) {
		return await db.select().from(exercises);
	}

	return (await db
		.select()
		.from(exercises)
		.where(conditions.length === 1 ? conditions[0] : and(...conditions))) as Exercise[];
});

export const getExercise = query(z.object({ id: z.string() }), async ({ id }) => {
	requireTeacherOrAdmin();
	const result = await db.select().from(exercises).where(eq(exercises.id, id));

	if (result.length === 0) {
		error(404, 'Exercise not found');
	}

	return result[0];
});

export const getExercisesByCourse = query(
	z.object({ courseId: z.string() }),
	async ({ courseId }) => {
		requireTeacherOrAdmin();
		// Verify course exists
		const course = await db.select().from(courses).where(eq(courses.id, courseId));
		if (course.length === 0) {
			error(404, 'Course not found');
		}

		return await db
			.select()
			.from(exercises)
			.where(eq(exercises.courseId, courseId))
			.orderBy(exercises.order);
	}
);

// =============================================================================
// Command Functions (Create/Update/Delete)
// =============================================================================

export const createExercise = command(createExerciseSchema, async (data) => {
	const user = requireTeacherOrAdmin();

	const id = crypto.randomUUID();
	const now = Date.now();

	await db.insert(exercises).values({
		id,
		courseId: data.courseId,
		type: data.type,
		content: data.content as unknown as ExerciseContent,
		config: data.config as unknown as ExerciseConfig,
		published: data.published ?? false,
		order: data.order ?? 0,
		createdBy: user?.email ?? 'system',
		createdAt: now,
		updatedAt: now
	});

	return { id };
});

export const updateExercise = command(updateExerciseSchema, async (data) => {
	const user = requireTeacherOrAdmin();
	const existing = await db.select().from(exercises).where(eq(exercises.id, data.id));

	if (existing.length === 0) {
		error(404, 'Exercise not found');
	}

	const updates: Record<string, unknown> = {
		updatedAt: Date.now(),
		updatedBy: user?.email ?? 'system'
	};

	if (data.courseId !== undefined) updates.courseId = data.courseId;
	if (data.type !== undefined) updates.type = data.type;
	if (data.content !== undefined) updates.content = data.content;
	if (data.config !== undefined) updates.config = data.config;
	if (data.published !== undefined) updates.published = data.published;
	if (data.order !== undefined) updates.order = data.order;

	await db.update(exercises).set(updates).where(eq(exercises.id, data.id));

	return { id: data.id };
});

export const deleteExercise = command(z.string(), async (id) => {
	requireTeacherOrAdmin();
	const existing = await db.select().from(exercises).where(eq(exercises.id, id));

	if (existing.length === 0) {
		error(404, 'Exercise not found');
	}

	await db.delete(exercises).where(eq(exercises.id, id));

	return { success: true };
});
