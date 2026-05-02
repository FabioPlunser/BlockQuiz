import type { CourseContent } from '$lib/types/course';
import type { PublishValidationResult } from '$lib/types/exercise';

export interface CoursePublishExercise {
	id: string;
	published: boolean;
	archivedAt?: number | null;
	validation?: PublishValidationResult | null;
}

export interface CoursePublishValidationIssue {
	code: string;
	field: string;
	message: string;
}

export interface CoursePublishValidationResult {
	valid: boolean;
	issues: CoursePublishValidationIssue[];
}

function createIssue(code: string, field: string, message: string): CoursePublishValidationIssue {
	return { code, field, message };
}

function plainText(value: string) {
	return value
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.trim();
}

function validateLocalizedText(
	value: { de: string; en: string },
	field: string,
	label: string,
	issues: CoursePublishValidationIssue[]
) {
	if (!plainText(value.de)) {
		issues.push(createIssue(`${field}.de.missing`, `${field}.de`, `${label} (DE) is required.`));
	}
	if (!plainText(value.en)) {
		issues.push(createIssue(`${field}.en.missing`, `${field}.en`, `${label} (EN) is required.`));
	}
}

export function validateCoursePublishReadiness(input: {
	content: CourseContent;
	exerciseIds: string[];
	exercises?: CoursePublishExercise[];
}): CoursePublishValidationResult {
	const issues: CoursePublishValidationIssue[] = [];

	validateLocalizedText(input.content.title, 'content.title', 'Title', issues);
	validateLocalizedText(input.content.description, 'content.description', 'Description', issues);

	if (input.exerciseIds.length === 0) {
		issues.push(
			createIssue('exercises.missing', 'exerciseIds', 'At least one exercise is required.')
		);
	}

	if (input.exercises) {
		const exercisesById = new Map(input.exercises.map((exercise) => [exercise.id, exercise]));

		for (const id of input.exerciseIds) {
			const exercise = exercisesById.get(id);
			if (!exercise) {
				issues.push(
					createIssue('exercises.unknown', 'exerciseIds', 'One selected exercise no longer exists.')
				);
				continue;
			}

			if (exercise.archivedAt != null) {
				issues.push(
					createIssue(
						'exercises.archived',
						'exerciseIds',
						'Archived exercises cannot be published in a course.'
					)
				);
			}

			if (!exercise.published) {
				issues.push(
					createIssue('exercises.draft', 'exerciseIds', 'All selected exercises must be published.')
				);
			}

			if (exercise.validation?.valid !== true) {
				issues.push(
					createIssue(
						'exercises.invalid',
						'exerciseIds',
						'All selected exercises must pass validation.'
					)
				);
			}
		}
	}

	return {
		valid: issues.length === 0,
		issues
	};
}

export function formatCoursePublishValidationError(result: CoursePublishValidationResult) {
	return result.issues.map((issue) => issue.message).join(' ');
}
