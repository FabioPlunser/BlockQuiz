import * as Blockly from 'blockly/core';
import { i18n } from '$lib/i18n/index.svelte';

/**
 * Maps custom Blockly Msg keys (used via `%{BKY_…}` placeholders or read
 * directly off `Blockly.Msg`) to their i18n dictionary keys. Engine block
 * messages and tooltips store the i18n key as `BlockDef.message` /
 * `BlockDef.tooltip`; `BlocklyFactory.initBlocks` resolves them through
 * `localized()` below.
 */
const KEYS: Array<[blocklyMsg: string, i18nKey: string]> = [
	['BKY_BLOCK_TURTLE_MOVE', 'block_turtle_move'],
	['BKY_BLOCK_TURTLE_TURN', 'block_turtle_turn'],
	['BKY_BLOCK_TURTLE_PEN', 'block_turtle_pen'],
	['BKY_BLOCK_TURTLE_PEN_DOWN', 'block_turtle_pen_down'],
	['BKY_BLOCK_TURTLE_PEN_UP', 'block_turtle_pen_up'],
	['BKY_BLOCK_TURTLE_COLOR', 'block_turtle_color'],
	['BKY_BLOCK_ROBOT_STEP', 'block_robot_step'],
	['BKY_BLOCK_ROBOT_STEP_TOOLTIP', 'block_robot_step_tooltip'],
	['BKY_BLOCK_ROBOT_TURN_LEFT', 'block_robot_turn_left'],
	['BKY_BLOCK_ROBOT_TURN_LEFT_TOOLTIP', 'block_robot_turn_left_tooltip'],
	['BKY_BLOCK_ROBOT_TURN_RIGHT', 'block_robot_turn_right'],
	['BKY_BLOCK_ROBOT_TURN_RIGHT_TOOLTIP', 'block_robot_turn_right_tooltip'],
	['BKY_BLOCK_ROBOT_COLLECT', 'block_robot_collect'],
	['BKY_BLOCK_ROBOT_COLLECT_TOOLTIP', 'block_robot_collect_tooltip']
];

/** Copy the current localized values of our custom keys into `Blockly.Msg`. */
export function syncCustomBlocklyMsg() {
	const dict = i18n as unknown as Record<string, unknown>;
	for (const [msgKey, i18nKey] of KEYS) {
		const val = dict[i18nKey];
		if (typeof val === 'string') Blockly.Msg[msgKey] = val;
	}
}

/** Resolve an i18n key to a localized string, falling back to the key itself. */
export function localized(i18nKey: string | undefined, fallback?: string): string {
	if (!i18nKey) return fallback ?? '';
	const v = (i18n as unknown as Record<string, unknown>)[i18nKey];
	if (typeof v === 'string' && v) return v;
	return fallback ?? i18nKey;
}

/**
 * Short labels for the CMS BlockPicker UI, keyed by Blockly block id.
 * The actual block text in the workspace comes from `blockly/msg/<locale>` —
 * this map only controls the human-friendly name shown in the author-side
 * picker (where Blockly's full message would be too long).
 */
export const BUILTIN_BLOCK_LABEL_KEYS: Record<string, string> = {
	controls_if: 'block_builtin_controls_if',
	logic_compare: 'block_builtin_logic_compare',
	logic_operation: 'block_builtin_logic_operation',
	logic_boolean: 'block_builtin_logic_boolean',
	logic_negate: 'block_builtin_logic_negate',
	controls_repeat_ext: 'block_builtin_controls_repeat_ext',
	controls_whileUntil: 'block_builtin_controls_while_until',
	controls_for: 'block_builtin_controls_for',
	math_number: 'block_builtin_math_number',
	math_arithmetic: 'block_builtin_math_arithmetic',
	math_round: 'block_builtin_math_round',
	math_number_property: 'block_builtin_math_number_property',
	math_change: 'block_builtin_math_change',
	text: 'block_builtin_text',
	text_print: 'block_builtin_text_print',
	text_join: 'block_builtin_text_join',
	text_prompt_ext: 'block_builtin_text_prompt_ext',
	text_append: 'block_builtin_text_append',
	variables_get: 'block_builtin_variables_get',
	variables_set: 'block_builtin_variables_set'
};
