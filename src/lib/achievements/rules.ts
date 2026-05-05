/**
 * Pure achievement rules engine.
 *
 * Given an attempt that just landed and a summary of the learner's history,
 * returns the badges that were *newly* earned. Pure so it can be tested in
 * isolation and re-used by both the authenticated and the guest path.
 *
 * Pedagogical framing: the badge set is grounded in Self-Determination Theory
 * (Deci & Ryan 2000) — competence (first solve, perfect-score streak),
 * autonomy (no-hint solves), and relatedness/breadth (locale variety,
 * course completion).
 */

export type BadgeKey =
	| 'first_solve'
	| 'streak_3'
	| 'streak_5'
	| 'streak_10'
	| 'no_hints'
	| 'perfect_score'
	| 'course_complete'
	| 'polyglot';

export const ALL_BADGES: readonly BadgeKey[] = [
	'first_solve',
	'streak_3',
	'streak_5',
	'streak_10',
	'no_hints',
	'perfect_score',
	'course_complete',
	'polyglot'
];

export interface AttemptSignal {
	exerciseId: string;
	passed: boolean;
	score: number;
	hintEventCount: number;
	locale: 'de' | 'en';
}

export interface HistorySnapshot {
	/** Badges already awarded to this learner. */
	earned: ReadonlySet<BadgeKey>;
	/** Number of consecutive passing attempts up to and including this one. */
	currentPassStreak: number;
	/** Locales used in any past passing attempt. */
	localesUsed: ReadonlySet<'de' | 'en'>;
	/** True if this attempt completed the last remaining exercise of a course. */
	completesCourse: boolean;
}

export interface BadgeAward {
	badge: BadgeKey;
	context: Record<string, unknown>;
}

/**
 * Evaluate which badges are newly earned by the given attempt.
 * Returns only badges not already in `history.earned`.
 */
export function evaluateBadges(attempt: AttemptSignal, history: HistorySnapshot): BadgeAward[] {
	const awards: BadgeAward[] = [];
	const has = (key: BadgeKey) => history.earned.has(key);

	const award = (badge: BadgeKey, context: Record<string, unknown> = {}) => {
		if (!has(badge)) awards.push({ badge, context });
	};

	if (!attempt.passed) return awards;

	award('first_solve', { exerciseId: attempt.exerciseId });

	if (attempt.score === 100) {
		award('perfect_score', { exerciseId: attempt.exerciseId, score: attempt.score });
	}

	if (attempt.hintEventCount === 0) {
		award('no_hints', { exerciseId: attempt.exerciseId });
	}

	if (history.currentPassStreak >= 3) {
		award('streak_3', { streak: history.currentPassStreak });
	}
	if (history.currentPassStreak >= 5) {
		award('streak_5', { streak: history.currentPassStreak });
	}
	if (history.currentPassStreak >= 10) {
		award('streak_10', { streak: history.currentPassStreak });
	}

	if (history.completesCourse) {
		award('course_complete', { exerciseId: attempt.exerciseId });
	}

	const locales = new Set<'de' | 'en'>(history.localesUsed);
	locales.add(attempt.locale);
	if (locales.size >= 2) {
		award('polyglot', { locales: [...locales].sort() });
	}

	return awards;
}
