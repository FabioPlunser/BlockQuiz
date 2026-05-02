import { describe, expect, it } from 'vitest';
import { createCourseResearchExport, pseudonymizeResearchId } from './research-export';

describe('research export', () => {
	it('creates stable scoped pseudonyms without exposing raw identifiers', async () => {
		expect.assertions(4);

		const first = await pseudonymizeResearchId('course:one', 'user-123', 'participant');
		const second = await pseudonymizeResearchId('course:one', 'user-123', 'participant');
		const otherScope = await pseudonymizeResearchId('course:two', 'user-123', 'participant');

		expect(first).toBe(second);
		expect(first).not.toBe(otherScope);
		expect(first).toMatch(/^participant-[a-f0-9]{24}$/);
		expect(first).not.toContain('user-123');
	});

	it('exports course attempts with pseudonymized participant and attempt ids', async () => {
		expect.assertions(10);

		const exported = await createCourseResearchExport({
			exportedAt: 123,
			course: {
				id: 'course-1',
				content: {
					title: { de: 'Kurs', en: 'Course' }
				}
			},
			exercises: [
				{
					id: 'exercise-1',
					type: 'io',
					content: {
						title: { de: 'Eingabe', en: 'Input' }
					}
				}
			],
			attempts: [
				{
					id: 'attempt-raw',
					exerciseId: 'exercise-1',
					userId: 'user-raw',
					clientId: null,
					actorType: 'user',
					score: 80,
					passed: true,
					startedAt: 10,
					endedAt: 40,
					locale: 'en',
					hintEventsJson: '[{"hintId":"h1","revealedAt":20,"trigger":"click"}]',
					analyticsJson:
						'{"totalTests":3,"passedTests":2,"workspaceBlockCount":8,"generatedCodeLength":120}',
					createdAt: 45
				}
			]
		});

		expect(exported.kind).toBe('course-research-attempts');
		expect(exported.course.title).toBe('Course');
		expect(exported.rows).toHaveLength(1);
		expect(JSON.stringify(exported)).not.toContain('user-raw');
		expect(JSON.stringify(exported)).not.toContain('attempt-raw');
		expect(exported.rows[0]).toMatchObject({
			actorType: 'user',
			exerciseId: 'exercise-1',
			exerciseTitle: 'Input',
			exerciseType: 'io',
			durationMs: 30,
			hintUsageCount: 1,
			totalTests: 3,
			passedTests: 2,
			workspaceBlockCount: 8,
			generatedCodeLength: 120,
			submittedAt: 45
		});
		expect(exported.rows[0].participantPseudonym).toMatch(/^participant-[a-f0-9]{24}$/);
		expect(exported.rows[0].attemptPseudonym).toMatch(/^attempt-[a-f0-9]{24}$/);
		expect(exported.rows[0].score).toBe(80);
		expect(exported.rows[0].passed).toBe(true);
	});
});
