import { describe, expect, it } from 'vitest';
import type { attempts as attemptsTable, exercises as exercisesTable } from '$lib/server/db/schema';
import {
	computeClassAnalytics,
	computeClassAnalyticsList,
	type ClassAnalyticsInput,
	type ClassAnalyticsListInput
} from './class-analytics';

type ExerciseRow = typeof exercisesTable.$inferSelect;
type AttemptRow = typeof attemptsTable.$inferSelect;

const helpers = {
	countHintEvents: (json: string) => {
		try {
			const parsed = JSON.parse(json);
			return Array.isArray(parsed) ? parsed.length : 0;
		} catch {
			return 0;
		}
	},
	parseAttemptAnalytics: (json: string) => {
		try {
			const parsed = JSON.parse(json);
			return {
				exerciseType: 'io',
				totalTests: 0,
				passedTests: 0,
				hintUsageCount: 0,
				submittedAt: 0,
				workspaceBlockCount: parsed.workspaceBlockCount ?? 0,
				generatedCodeLength: parsed.generatedCodeLength ?? 0
			} as ReturnType<ClassAnalyticsInput['parseAttemptAnalytics']>;
		} catch {
			return {
				exerciseType: 'io',
				totalTests: 0,
				passedTests: 0,
				hintUsageCount: 0,
				submittedAt: 0
			} as ReturnType<ClassAnalyticsInput['parseAttemptAnalytics']>;
		}
	}
};

function makeExercise(id: string, type: 'io' | 'turtle' | 'robot' = 'io'): ExerciseRow {
	return {
		id,
		type,
		content: { title: { de: id, en: id } },
		config: {},
		validationJson: '{}',
		image: null,
		published: true,
		demo: false,
		archivedAt: null,
		archivedBy: null,
		createdAt: 0,
		updatedAt: 0,
		createdBy: 'teacher'
	} as unknown as ExerciseRow;
}

let attemptCounter = 0;
function makeAttempt(opts: {
	exerciseId: string;
	userId: string | null;
	score: number;
	passed: boolean;
	startedAt?: number;
	endedAt?: number;
	createdAt?: number;
	locale?: 'de' | 'en';
	hintEvents?: number;
	workspaceBlockCount?: number;
	generatedCodeLength?: number;
}): AttemptRow {
	attemptCounter += 1;
	return {
		id: `attempt-${attemptCounter}`,
		exerciseId: opts.exerciseId,
		userId: opts.userId,
		clientId: opts.userId ? null : 'guest-1',
		actorType: opts.userId ? 'user' : 'guest',
		workspaceXml: '',
		generatedCode: '',
		resultJson: '{}',
		locale: opts.locale ?? 'de',
		startedAt: opts.startedAt ?? 0,
		endedAt: opts.endedAt ?? 1000,
		score: opts.score,
		passed: opts.passed,
		hintEventsJson: JSON.stringify(
			Array.from({ length: opts.hintEvents ?? 0 }, (_, i) => ({
				hintId: `h${i}`,
				revealedAt: 0,
				trigger: 'click'
			}))
		),
		analyticsJson: JSON.stringify({
			workspaceBlockCount: opts.workspaceBlockCount ?? 0,
			generatedCodeLength: opts.generatedCodeLength ?? 0
		}),
		createdAt: opts.createdAt ?? 0
	} as unknown as AttemptRow;
}

describe('computeClassAnalyticsList', () => {
	it('returns zero rollups for a class with no attempts', () => {
		const exercises = [makeExercise('ex1')];
		const input: ClassAnalyticsListInput = {
			classes: [
				{
					classId: 'c1',
					className: 'Class 1',
					description: null,
					archivedAt: null,
					courseIds: ['course1'],
					exerciseIds: ['ex1'],
					enrolledUserIds: ['u1', 'u2']
				}
			],
			exerciseRows: exercises,
			attemptRows: [],
			...helpers
		};

		const [summary] = computeClassAnalyticsList(input);
		expect(summary.totals.attempts).toBe(0);
		expect(summary.totals.passRate).toBe(0);
		expect(summary.totals.students).toBe(0);
		expect(summary.totals.enrolledStudents).toBe(2);
		expect(summary.enrolledStudents).toBe(2);
		expect(summary.lastActivityAt).toBeNull();
	});

	it('aggregates attempts across enrolled students only', () => {
		const exercises = [makeExercise('ex1'), makeExercise('ex2')];
		const input: ClassAnalyticsListInput = {
			classes: [
				{
					classId: 'c1',
					className: 'Class 1',
					description: null,
					archivedAt: null,
					courseIds: ['course1'],
					exerciseIds: ['ex1', 'ex2'],
					enrolledUserIds: ['u1', 'u2']
				}
			],
			exerciseRows: exercises,
			attemptRows: [
				makeAttempt({ exerciseId: 'ex1', userId: 'u1', score: 80, passed: true, createdAt: 10 }),
				makeAttempt({ exerciseId: 'ex2', userId: 'u1', score: 50, passed: false, createdAt: 20 }),
				makeAttempt({ exerciseId: 'ex1', userId: 'u2', score: 100, passed: true, createdAt: 5 }),
				makeAttempt({ exerciseId: 'ex1', userId: 'u3', score: 90, passed: true, createdAt: 30 })
			],
			...helpers
		};

		const [summary] = computeClassAnalyticsList(input);
		expect(summary.totals.attempts).toBe(3);
		expect(summary.totals.students).toBe(2);
		expect(summary.totals.passRate).toBe(67);
		expect(summary.totals.avgScore).toBe(Math.round((80 + 50 + 100) / 3));
		expect(summary.lastActivityAt).toBe(20);
	});

	it('does not bleed attempts between classes that share exercises', () => {
		const exercises = [makeExercise('ex1')];
		const input: ClassAnalyticsListInput = {
			classes: [
				{
					classId: 'c1',
					className: 'A',
					description: null,
					archivedAt: null,
					courseIds: ['course1'],
					exerciseIds: ['ex1'],
					enrolledUserIds: ['u1']
				},
				{
					classId: 'c2',
					className: 'B',
					description: null,
					archivedAt: null,
					courseIds: ['course1'],
					exerciseIds: ['ex1'],
					enrolledUserIds: ['u2']
				}
			],
			exerciseRows: exercises,
			attemptRows: [
				makeAttempt({ exerciseId: 'ex1', userId: 'u1', score: 10, passed: false }),
				makeAttempt({ exerciseId: 'ex1', userId: 'u2', score: 90, passed: true })
			],
			...helpers
		};

		const [a, b] = computeClassAnalyticsList(input);
		expect(a.totals.attempts).toBe(1);
		expect(a.totals.passRate).toBe(0);
		expect(b.totals.attempts).toBe(1);
		expect(b.totals.passRate).toBe(100);
	});
});

describe('computeClassAnalytics', () => {
	it('produces one row per enrolled student even with no attempts', () => {
		const result = computeClassAnalytics({
			classId: 'c1',
			className: 'C',
			description: null,
			archivedAt: null,
			exerciseIds: ['ex1'],
			courseIds: ['course1'],
			enrolledUsers: [
				{ id: 'u1', name: 'Alice', email: 'a@x' },
				{ id: 'u2', name: null, email: 'b@x' }
			],
			exerciseRows: [makeExercise('ex1')],
			attemptRows: [],
			...helpers
		});

		expect(result.students).toHaveLength(2);
		expect(result.students[0].attempts).toBe(0);
		expect(result.totals.students).toBe(0);
		expect(result.totals.enrolledStudents).toBe(2);
		expect(result.students.find((s) => s.userId === 'u2')?.name).toBe('b@x');
	});

	it('tracks per-student exercises attempted and passed', () => {
		const result = computeClassAnalytics({
			classId: 'c1',
			className: 'C',
			description: null,
			archivedAt: null,
			exerciseIds: ['ex1', 'ex2', 'ex3'],
			courseIds: ['course1'],
			enrolledUsers: [{ id: 'u1', name: 'Alice', email: 'a@x' }],
			exerciseRows: [makeExercise('ex1'), makeExercise('ex2'), makeExercise('ex3')],
			attemptRows: [
				makeAttempt({ exerciseId: 'ex1', userId: 'u1', score: 60, passed: false }),
				makeAttempt({ exerciseId: 'ex1', userId: 'u1', score: 100, passed: true }),
				makeAttempt({ exerciseId: 'ex2', userId: 'u1', score: 80, passed: true })
			],
			...helpers
		});

		const alice = result.students[0];
		expect(alice.attempts).toBe(3);
		expect(alice.exercisesAttempted).toBe(2);
		expect(alice.exercisesPassed).toBe(2);
		expect(alice.passRate).toBe(67);
	});

	it('counts locale split and hint usage', () => {
		const result = computeClassAnalytics({
			classId: 'c1',
			className: 'C',
			description: null,
			archivedAt: null,
			exerciseIds: ['ex1'],
			courseIds: ['course1'],
			enrolledUsers: [{ id: 'u1', name: 'A', email: 'a@x' }],
			exerciseRows: [makeExercise('ex1')],
			attemptRows: [
				makeAttempt({
					exerciseId: 'ex1',
					userId: 'u1',
					score: 100,
					passed: true,
					locale: 'de',
					hintEvents: 2
				}),
				makeAttempt({
					exerciseId: 'ex1',
					userId: 'u1',
					score: 50,
					passed: false,
					locale: 'en',
					hintEvents: 1
				})
			],
			...helpers
		});

		expect(result.totals.localeCounts).toEqual({ de: 1, en: 1 });
		expect(result.totals.hintUsageCount).toBe(3);
		expect(result.students[0].hintUsageCount).toBe(3);
	});

	it('excludes guest attempts (no userId)', () => {
		const result = computeClassAnalytics({
			classId: 'c1',
			className: 'C',
			description: null,
			archivedAt: null,
			exerciseIds: ['ex1'],
			courseIds: ['course1'],
			enrolledUsers: [{ id: 'u1', name: 'A', email: 'a@x' }],
			exerciseRows: [makeExercise('ex1')],
			attemptRows: [
				makeAttempt({ exerciseId: 'ex1', userId: null, score: 100, passed: true }),
				makeAttempt({ exerciseId: 'ex1', userId: 'u1', score: 50, passed: false })
			],
			...helpers
		});

		expect(result.totals.attempts).toBe(1);
		expect(result.students[0].attempts).toBe(1);
	});
});
