/**
 * Display metadata for achievement badges. Kept separate from `rules.ts` so
 * the rules engine stays free of UI concerns.
 */

import type { BadgeKey } from './rules';

export interface BadgeMeta {
	key: BadgeKey;
	emoji: string;
	titleKey: string;
	descriptionKey: string;
}

export const BADGE_META: Record<BadgeKey, BadgeMeta> = {
	first_solve: {
		key: 'first_solve',
		emoji: '🎉',
		titleKey: 'badge_first_solve_title',
		descriptionKey: 'badge_first_solve_description'
	},
	streak_3: {
		key: 'streak_3',
		emoji: '🔥',
		titleKey: 'badge_streak_3_title',
		descriptionKey: 'badge_streak_3_description'
	},
	streak_5: {
		key: 'streak_5',
		emoji: '🔥',
		titleKey: 'badge_streak_5_title',
		descriptionKey: 'badge_streak_5_description'
	},
	streak_10: {
		key: 'streak_10',
		emoji: '⚡',
		titleKey: 'badge_streak_10_title',
		descriptionKey: 'badge_streak_10_description'
	},
	no_hints: {
		key: 'no_hints',
		emoji: '🧠',
		titleKey: 'badge_no_hints_title',
		descriptionKey: 'badge_no_hints_description'
	},
	perfect_score: {
		key: 'perfect_score',
		emoji: '⭐',
		titleKey: 'badge_perfect_score_title',
		descriptionKey: 'badge_perfect_score_description'
	},
	course_complete: {
		key: 'course_complete',
		emoji: '🏆',
		titleKey: 'badge_course_complete_title',
		descriptionKey: 'badge_course_complete_description'
	},
	polyglot: {
		key: 'polyglot',
		emoji: '🌍',
		titleKey: 'badge_polyglot_title',
		descriptionKey: 'badge_polyglot_description'
	}
};
