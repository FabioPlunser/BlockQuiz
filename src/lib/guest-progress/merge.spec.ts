import { describe, expect, it } from 'vitest';
import { mergeGuestProgressData } from './merge';
import type { GuestAttemptSnapshot, GuestProgressExport } from './types';

function attempt(overrides: Partial<GuestAttemptSnapshot>): GuestAttemptSnapshot {
	const createdAt = overrides.createdAt ?? 1;
	return {
		id: overrides.id ?? `attempt-${createdAt}`,
		exerciseId: overrides.exerciseId ?? 'exercise-1',
		clientId: overrides.clientId ?? 'client-a',
		actorType: 'guest',
		workspaceXml: overrides.workspaceXml ?? '<xml />',
		generatedCode: overrides.generatedCode ?? '',
		resultJson: overrides.resultJson ?? '{}',
		locale: overrides.locale ?? 'de',
		startedAt: overrides.startedAt ?? createdAt,
		endedAt: overrides.endedAt ?? createdAt + 10,
		score: overrides.score ?? 0,
		passed: overrides.passed ?? false,
		hintEventsJson: overrides.hintEventsJson ?? '[]',
		analyticsJson: overrides.analyticsJson ?? '{}',
		createdAt
	};
}

function progress(overrides: Partial<GuestProgressExport>): GuestProgressExport {
	return {
		version: 1,
		clientId: overrides.clientId ?? 'client-a',
		exportedAt: overrides.exportedAt ?? 1,
		courses: overrides.courses ?? [],
		attempts: overrides.attempts ?? []
	};
}

describe('mergeGuestProgressData', () => {
	it('preserves attempt history and recomputes the best score per exercise', () => {
		expect.assertions(7);

		const merged = mergeGuestProgressData(
			progress({
				clientId: 'current-client',
				courses: [
					{
						courseId: 'course-1',
						exerciseIds: ['exercise-1'],
						exerciseProgress: {},
						completedCount: 0,
						exerciseCount: 1,
						progress: 0,
						updatedAt: 10
					}
				],
				attempts: [attempt({ id: 'low', exerciseId: 'exercise-1', score: 25, createdAt: 10 })]
			}),
			progress({
				clientId: 'imported-client',
				courses: [
					{
						courseId: 'course-1',
						exerciseIds: ['exercise-1', 'exercise-2'],
						exerciseProgress: {},
						completedCount: 0,
						exerciseCount: 2,
						progress: 0,
						lastExerciseId: 'exercise-2',
						lastExerciseIndex: 1,
						updatedAt: 20
					}
				],
				attempts: [
					attempt({ id: 'best', exerciseId: 'exercise-1', score: 90, passed: true, createdAt: 20 }),
					attempt({ id: 'second', exerciseId: 'exercise-2', score: 50, createdAt: 30 })
				]
			}),
			100
		);

		expect(merged.clientId).toBe('current-client');
		expect(merged.attempts.map((entry) => entry.id)).toEqual(['low', 'best', 'second']);
		expect(merged.attempts.every((entry) => entry.clientId === 'current-client')).toBe(true);
		expect(merged.courses[0].exerciseIds).toEqual(['exercise-1', 'exercise-2']);
		expect(merged.courses[0].exerciseProgress['exercise-1']).toMatchObject({
			bestScore: 90,
			passed: true,
			attemptCount: 2,
			lastAttemptId: 'best'
		});
		expect(merged.courses[0].completedCount).toBe(1);
		expect(merged.courses[0].progress).toBe(50);
	});

	it('deduplicates repeated imported attempts by id', () => {
		expect.assertions(3);

		const merged = mergeGuestProgressData(
			progress({
				clientId: 'current-client',
				courses: [
					{
						courseId: 'course-1',
						exerciseIds: ['exercise-1'],
						exerciseProgress: {},
						completedCount: 0,
						exerciseCount: 1,
						progress: 0,
						updatedAt: 10
					}
				],
				attempts: [attempt({ id: 'same', score: 10, createdAt: 10 })]
			}),
			progress({
				clientId: 'imported-client',
				courses: [],
				attempts: [attempt({ id: 'same', score: 70, passed: true, createdAt: 20 })]
			}),
			100
		);

		expect(merged.attempts).toHaveLength(1);
		expect(merged.attempts[0]).toMatchObject({ id: 'same', score: 70, clientId: 'current-client' });
		expect(merged.courses[0].exerciseProgress['exercise-1'].bestScore).toBe(70);
	});
});
