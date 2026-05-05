import { describe, it, expect } from 'vitest';
import { evaluateBadges, type BadgeKey, type HistorySnapshot } from './rules';

const baseHistory = (overrides: Partial<HistorySnapshot> = {}): HistorySnapshot => ({
	earned: new Set(),
	currentPassStreak: 0,
	localesUsed: new Set(),
	completesCourse: false,
	...overrides
});

describe('evaluateBadges', () => {
	it('awards nothing when the attempt failed', () => {
		expect.assertions(1);
		const awards = evaluateBadges(
			{ exerciseId: 'e1', passed: false, score: 0, hintEventCount: 0, locale: 'en' },
			baseHistory()
		);
		expect(awards).toEqual([]);
	});

	it('awards first_solve, perfect_score, and no_hints on a clean first pass', () => {
		expect.assertions(1);
		const awards = evaluateBadges(
			{ exerciseId: 'e1', passed: true, score: 100, hintEventCount: 0, locale: 'en' },
			baseHistory({ currentPassStreak: 1 })
		);
		const keys = awards.map((a) => a.badge).sort();
		expect(keys).toEqual<BadgeKey[]>(['first_solve', 'no_hints', 'perfect_score']);
	});

	it('does not re-award badges already earned', () => {
		expect.assertions(1);
		const awards = evaluateBadges(
			{ exerciseId: 'e1', passed: true, score: 100, hintEventCount: 0, locale: 'en' },
			baseHistory({
				earned: new Set(['first_solve', 'no_hints', 'perfect_score']),
				currentPassStreak: 1
			})
		);
		expect(awards).toEqual([]);
	});

	it('awards streak_3 when the current streak hits 3', () => {
		expect.assertions(1);
		const awards = evaluateBadges(
			{ exerciseId: 'e3', passed: true, score: 80, hintEventCount: 1, locale: 'en' },
			baseHistory({
				earned: new Set(['first_solve']),
				currentPassStreak: 3
			})
		);
		const keys = awards.map((a) => a.badge);
		expect(keys).toContain<BadgeKey>('streak_3');
	});

	it('awards streak_3 and streak_5 together when the current streak hits 5', () => {
		expect.assertions(1);
		const awards = evaluateBadges(
			{ exerciseId: 'e5', passed: true, score: 90, hintEventCount: 0, locale: 'en' },
			baseHistory({
				earned: new Set(['first_solve', 'no_hints', 'perfect_score']),
				currentPassStreak: 5
			})
		);
		const keys = awards.map((a) => a.badge).sort();
		expect(keys).toEqual<BadgeKey[]>(['streak_3', 'streak_5']);
	});

	it('awards polyglot when the learner solves in both DE and EN', () => {
		expect.assertions(1);
		const awards = evaluateBadges(
			{ exerciseId: 'e2', passed: true, score: 80, hintEventCount: 1, locale: 'de' },
			baseHistory({
				earned: new Set(['first_solve']),
				localesUsed: new Set(['en']),
				currentPassStreak: 2
			})
		);
		const keys = awards.map((a) => a.badge);
		expect(keys).toContain<BadgeKey>('polyglot');
	});

	it('awards course_complete when the attempt finishes the last exercise of a course', () => {
		expect.assertions(1);
		const awards = evaluateBadges(
			{ exerciseId: 'eN', passed: true, score: 100, hintEventCount: 2, locale: 'en' },
			baseHistory({
				earned: new Set(['first_solve', 'perfect_score']),
				currentPassStreak: 4,
				completesCourse: true
			})
		);
		const keys = awards.map((a) => a.badge);
		expect(keys).toContain<BadgeKey>('course_complete');
	});
});
