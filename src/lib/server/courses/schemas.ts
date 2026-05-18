import { z } from 'zod';
import { contentSchema, courseTransferSchema } from '$lib/import-export/transfers';

export const createCourseSchema = z.object({
	content: contentSchema,
	published: z.boolean().optional().default(false),
	exerciseIds: z.array(z.string()).optional().default([]),
	userIds: z.array(z.string()).optional().default([]),
	classIds: z.array(z.string()).optional().default([])
});

export const updateCourseSchema = createCourseSchema.extend({ id: z.string() });
export const courseCloneSchema = z.object({ id: z.string() });
export const courseArchiveSchema = z.object({ id: z.string() });
export const importCourseSchema = z.object({ payload: courseTransferSchema });

export const hintRevealEventSchema = z.object({
	hintId: z.string(),
	revealedAt: z.number(),
	trigger: z.enum(['click', 'time'])
});

export const attemptAnalyticsSchema = z.object({
	exerciseType: z.enum(['io', 'turtle', 'robot']),
	totalTests: z.number().int().nonnegative(),
	passedTests: z.number().int().nonnegative(),
	hintUsageCount: z.number().int().nonnegative(),
	submittedAt: z.number(),
	workspaceBlockCount: z.number().int().nonnegative().optional(),
	generatedCodeLength: z.number().int().nonnegative().optional()
});

export const submitAttemptSchema = z.object({
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
