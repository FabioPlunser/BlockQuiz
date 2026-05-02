import * as z from 'zod';

export const localizedStringSchema = z.object({
	de: z.string(),
	en: z.string()
});

export const contentSchema = z.object({
	title: localizedStringSchema,
	description: localizedStringSchema,
	image: z.string().optional().default('')
});

export const exportedExerciseSchema = z.object({
	type: z.enum(['io', 'turtle', 'robot']),
	content: z.unknown(),
	config: z.unknown(),
	published: z.boolean().optional().default(false),
	order: z.number().optional().default(0),
	originalId: z.string().optional()
});

export const exerciseTransferSchema = z.object({
	schemaVersion: z.literal(1),
	kind: z.literal('exercise'),
	exportedAt: z.number(),
	exercise: exportedExerciseSchema
});

export const courseTransferSchema = z.object({
	schemaVersion: z.literal(1),
	kind: z.literal('course'),
	exportedAt: z.number(),
	course: z.object({
		content: contentSchema,
		published: z.boolean().default(false),
		originalId: z.string().optional()
	}),
	exercises: z.array(exportedExerciseSchema)
});

export type ExerciseTransfer = z.infer<typeof exerciseTransferSchema>;
export type CourseTransfer = z.infer<typeof courseTransferSchema>;

export interface TransferExerciseInput {
	id: string;
	type: 'io' | 'turtle' | 'robot';
	content: unknown;
	config: unknown;
	published: boolean;
	order?: number;
}

export interface TransferCourseInput {
	id: string;
	content: unknown;
	published: boolean;
}

export type TransferPreview =
	| {
			valid: true;
			kind: 'exercise';
			title: string;
			exerciseType: 'io' | 'turtle' | 'robot';
			exerciseCount: 1;
			willImportAsDraft: true;
	  }
	| {
			valid: true;
			kind: 'course';
			title: string;
			exerciseCount: number;
			willImportAsDraft: true;
	  }
	| {
			valid: false;
			kind: 'unknown';
			error: string;
	  };

function getLocalizedTitle(value: unknown, fallback: string): string {
	const content = value as { title?: { de?: unknown; en?: unknown } } | undefined;
	const title = content?.title;

	return typeof title?.en === 'string' && title.en.trim()
		? title.en
		: typeof title?.de === 'string' && title.de.trim()
			? title.de
			: fallback;
}

function formatZodError(error: z.ZodError): string {
	const issue = error.issues[0];
	if (!issue) {
		return 'The selected JSON file does not match a supported BlockQuiz export format.';
	}

	const path = issue.path.length > 0 ? issue.path.join('.') : 'file';
	return `${path}: ${issue.message}`;
}

export function parseExerciseTransfer(payload: unknown) {
	return exerciseTransferSchema.safeParse(payload);
}

export function parseCourseTransfer(payload: unknown) {
	return courseTransferSchema.safeParse(payload);
}

export function createExerciseTransfer(
	exercise: TransferExerciseInput,
	exportedAt = Date.now()
): ExerciseTransfer {
	return exerciseTransferSchema.parse({
		schemaVersion: 1,
		kind: 'exercise',
		exportedAt,
		exercise: {
			originalId: exercise.id,
			type: exercise.type,
			content: exercise.content,
			config: exercise.config,
			published: exercise.published,
			order: exercise.order ?? 0
		}
	});
}

export function createCourseTransfer(
	course: TransferCourseInput,
	exercises: TransferExerciseInput[],
	exportedAt = Date.now()
): CourseTransfer {
	return courseTransferSchema.parse({
		schemaVersion: 1,
		kind: 'course',
		exportedAt,
		course: {
			originalId: course.id,
			content: course.content,
			published: course.published
		},
		exercises: exercises.map((exercise) => ({
			originalId: exercise.id,
			type: exercise.type,
			content: exercise.content,
			config: exercise.config,
			published: exercise.published,
			order: exercise.order ?? 0
		}))
	});
}

export function previewExerciseTransfer(payload: unknown): TransferPreview {
	const parsed = parseExerciseTransfer(payload);
	if (!parsed.success) {
		return {
			valid: false,
			kind: 'unknown',
			error: formatZodError(parsed.error)
		};
	}

	return {
		valid: true,
		kind: 'exercise',
		title: getLocalizedTitle(parsed.data.exercise.content, 'Imported exercise'),
		exerciseType: parsed.data.exercise.type,
		exerciseCount: 1,
		willImportAsDraft: true
	};
}

export function previewCourseTransfer(payload: unknown): TransferPreview {
	const parsed = parseCourseTransfer(payload);
	if (!parsed.success) {
		return {
			valid: false,
			kind: 'unknown',
			error: formatZodError(parsed.error)
		};
	}

	return {
		valid: true,
		kind: 'course',
		title: getLocalizedTitle(parsed.data.course.content, 'Imported course'),
		exerciseCount: parsed.data.exercises.length,
		willImportAsDraft: true
	};
}
