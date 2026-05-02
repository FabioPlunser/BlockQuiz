import { describe, expect, it } from 'vitest';
import { validateCoursePublishReadiness } from './validation';

const validContent = {
	title: { de: 'Ein Kurs', en: 'A course' },
	description: { de: '<p>Beschreibung</p>', en: '<p>Description</p>' },
	image: ''
};

describe('validateCoursePublishReadiness', () => {
	it('requires localized content and published valid exercises', () => {
		expect.assertions(3);

		const result = validateCoursePublishReadiness({
			content: {
				title: { de: '', en: 'A course' },
				description: { de: '<p><br></p>', en: '<p>Description</p>' },
				image: ''
			},
			exerciseIds: ['exercise-1'],
			exercises: [
				{
					id: 'exercise-1',
					published: false,
					validation: { valid: true, issues: [] }
				}
			]
		});

		expect(result.valid).toBe(false);
		expect(result.issues.some((issue) => issue.code === 'content.title.de.missing')).toBe(true);
		expect(result.issues.some((issue) => issue.code === 'exercises.draft')).toBe(true);
	});

	it('rejects a published course with any selected draft, invalid, archived, or missing exercise', () => {
		expect.assertions(5);

		const result = validateCoursePublishReadiness({
			content: validContent,
			exerciseIds: ['valid', 'draft', 'invalid', 'archived', 'missing'],
			exercises: [
				{
					id: 'valid',
					published: true,
					validation: { valid: true, issues: [] }
				},
				{
					id: 'draft',
					published: false,
					validation: { valid: true, issues: [] }
				},
				{
					id: 'invalid',
					published: true,
					validation: { valid: false, issues: [] }
				},
				{
					id: 'archived',
					published: true,
					archivedAt: 1,
					validation: { valid: true, issues: [] }
				}
			]
		});

		expect(result.valid).toBe(false);
		expect(result.issues.some((issue) => issue.code === 'exercises.draft')).toBe(true);
		expect(result.issues.some((issue) => issue.code === 'exercises.invalid')).toBe(true);
		expect(result.issues.some((issue) => issue.code === 'exercises.archived')).toBe(true);
		expect(result.issues.some((issue) => issue.code === 'exercises.unknown')).toBe(true);
	});

	it('accepts a course with complete metadata and a published valid exercise', () => {
		expect.assertions(2);

		const result = validateCoursePublishReadiness({
			content: validContent,
			exerciseIds: ['exercise-1'],
			exercises: [
				{
					id: 'exercise-1',
					published: true,
					validation: { valid: true, issues: [] }
				}
			]
		});

		expect(result.valid).toBe(true);
		expect(result.issues).toHaveLength(0);
	});
});
