import { describe, expect, it } from 'vitest';
import {
	createCourseTransfer,
	createExerciseTransfer,
	parseCourseTransfer,
	parseExerciseTransfer,
	previewCourseTransfer,
	previewExerciseTransfer
} from './transfers';

const localizedContent = {
	title: { de: 'Roboter-Labyrinth', en: 'Robot maze' },
	description: { de: 'Finde den Ausgang.', en: 'Find the exit.' },
	image: ''
};

describe('transfer schemas', () => {
	it('round-trips an exercise transfer through JSON', () => {
		expect.assertions(5);

		const transfer = createExerciseTransfer(
			{
				id: 'exercise-original',
				type: 'robot',
				content: localizedContent,
				config: {
					grid: {
						width: 4,
						height: 3,
						cellSize: 50,
						start: { x: 1, y: 2 },
						direction: 'east',
						walls: [{ x: 2, y: 2 }],
						targets: [{ x: 3, y: 2 }]
					}
				},
				published: true,
				order: 7
			},
			123
		);

		const parsed = parseExerciseTransfer(JSON.parse(JSON.stringify(transfer)));
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;

		expect(parsed.data.exercise.originalId).toBe('exercise-original');
		expect(parsed.data.exercise.published).toBe(true);
		expect(parsed.data.exercise.order).toBe(7);
		expect(previewExerciseTransfer(parsed.data)).toMatchObject({
			valid: true,
			kind: 'exercise',
			title: 'Robot maze',
			exerciseType: 'robot',
			willImportAsDraft: true
		});
	});

	it('round-trips a course transfer and normalizes missing image data', () => {
		expect.assertions(5);

		const transfer = createCourseTransfer(
			{
				id: 'course-original',
				content: {
					title: { de: 'Kurs', en: 'Course' },
					description: { de: 'Beschreibung', en: 'Description' }
				},
				published: true
			},
			[
				{
					id: 'exercise-one',
					type: 'io',
					content: localizedContent,
					config: { io: { mode: 'stdin-stdout', tests: [] } },
					published: true,
					order: 0
				}
			],
			456
		);

		const parsed = parseCourseTransfer(JSON.parse(JSON.stringify(transfer)));
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;

		expect(parsed.data.course.originalId).toBe('course-original');
		expect(parsed.data.course.content.image).toBe('');
		expect(parsed.data.exercises[0].originalId).toBe('exercise-one');
		expect(previewCourseTransfer(parsed.data)).toMatchObject({
			valid: true,
			kind: 'course',
			title: 'Course',
			exerciseCount: 1,
			willImportAsDraft: true
		});
	});

	it('returns a teacher-readable preview error for unsupported payloads', () => {
		expect.assertions(2);

		const preview = previewCourseTransfer({ schemaVersion: 2, kind: 'course' });

		expect(preview.valid).toBe(false);
		expect(preview).toMatchObject({
			valid: false,
			kind: 'unknown',
			error: expect.stringContaining('schemaVersion')
		});
	});
});
