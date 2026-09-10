/**
 * Blockly theme that harmonises with the app's "warm" daisyUI theme.
 *
 * The Blockly Theme API does not accept CSS custom properties — colours have
 * to be hex/hue strings at theme construction time. So we ship pre-resolved
 * hex equivalents of the warm palette declared in `src/lib/app.css`. Tweak
 * those constants here when the palette changes; there is no runtime binding.
 *
 * Reference: https://developers.google.com/blockly/guides/configure/web/appearance/themes
 */

import * as Blockly from 'blockly/core';
import type { Theme as BlockQuizTheme } from '$lib/theme.svelte';

// --- Warm palette (approximate hex equivalents of the oklch values in app.css) ---
// app.css `--color-base-100  oklch(98% 0.013 76)`
const WARM_BASE_100 = '#fbf6ea';
// app.css `--color-base-200  oklch(95% 0.018 76)`
const WARM_BASE_200 = '#f3ede0';
// app.css `--color-base-300  oklch(89% 0.022 76)`
const WARM_BASE_300 = '#e6dccb';
// app.css `--color-base-content oklch(22% 0.02 40)`
const WARM_BASE_CONTENT = '#3a2e25';
// app.css `--color-primary  oklch(58% 0.14 35)` — rust
const WARM_PRIMARY = '#b9550a';
// app.css `--color-secondary oklch(65% 0.07 145)` — sage
const WARM_SECONDARY = '#7da084';
// app.css `--color-accent oklch(82% 0.13 85)` — warm yellow
const WARM_ACCENT = '#d9b561';

/**
 * Block colour buckets — six warm-spectrum tones chosen so that each category
 * stays distinguishable but the overall palette reads as one family. Used both
 * for the toolbox category pills and the blocks themselves.
 *
 * Primary = headline colour, Secondary = lighter top accent, Tertiary = border.
 */
const BLOCK_BUCKETS = {
	logic: { primary: '#8a4b2d', secondary: '#b9714f', tertiary: '#6b3a23' }, // terracotta
	loops: { primary: '#7d8a3b', secondary: '#a5b35a', tertiary: '#5e6b28' }, // olive
	math: { primary: '#a85a2b', secondary: '#d28252', tertiary: '#824421' }, // burnt orange
	text: { primary: '#946945', secondary: '#b88a64', tertiary: '#705034' }, // cocoa
	variables: { primary: '#8a3a4d', secondary: '#b25a6b', tertiary: '#682b3a' }, // plum
	engine: { primary: WARM_PRIMARY, secondary: '#d97a3f', tertiary: '#8a3f06' }, // rust headline
	input: { primary: '#3f6b8a', secondary: '#5b8eb0', tertiary: '#284a63' } // steel blue — distinct from text
} as const;

// Blockly normalises theme names to lowercase internally — match it here so
// equality checks in tests + consumers don't surprise.
export const WARM_BLOCKLY_THEME_NAME = 'blockquizwarm';

/**
 * Built from Blockly.Themes.Classic so any property we don't set falls back
 * to the Classic defaults — keeps the same hat/font behaviour and any future
 * defaults added by Blockly upstream.
 */
export const warmBlocklyTheme: Blockly.Theme = Blockly.Theme.defineTheme(
	WARM_BLOCKLY_THEME_NAME,
	{
		name: WARM_BLOCKLY_THEME_NAME,
		base: Blockly.Themes.Classic,
		componentStyles: {
			workspaceBackgroundColour: WARM_BASE_200,
			toolboxBackgroundColour: WARM_BASE_300,
			toolboxForegroundColour: WARM_BASE_CONTENT,
			flyoutBackgroundColour: WARM_BASE_100,
			flyoutForegroundColour: WARM_BASE_CONTENT,
			flyoutOpacity: 0.95,
			scrollbarColour: WARM_BASE_CONTENT,
			scrollbarOpacity: 0.3,
			insertionMarkerColour: WARM_PRIMARY,
			insertionMarkerOpacity: 0.4,
			markerColour: WARM_PRIMARY,
			cursorColour: WARM_ACCENT,
			selectedGlowColour: WARM_PRIMARY,
			selectedGlowOpacity: 0.5,
			replacementGlowColour: WARM_SECONDARY,
			replacementGlowOpacity: 0.6
		},
		categoryStyles: {
			logic_category: { colour: BLOCK_BUCKETS.logic.primary },
			loop_category: { colour: BLOCK_BUCKETS.loops.primary },
			math_category: { colour: BLOCK_BUCKETS.math.primary },
			text_category: { colour: BLOCK_BUCKETS.text.primary },
			variable_category: { colour: BLOCK_BUCKETS.variables.primary },
			engine_category: { colour: BLOCK_BUCKETS.engine.primary },
			input_category: { colour: BLOCK_BUCKETS.input.primary }
		},
		blockStyles: {
			logic_blocks: {
				colourPrimary: BLOCK_BUCKETS.logic.primary,
				colourSecondary: BLOCK_BUCKETS.logic.secondary,
				colourTertiary: BLOCK_BUCKETS.logic.tertiary
			},
			loop_blocks: {
				colourPrimary: BLOCK_BUCKETS.loops.primary,
				colourSecondary: BLOCK_BUCKETS.loops.secondary,
				colourTertiary: BLOCK_BUCKETS.loops.tertiary
			},
			math_blocks: {
				colourPrimary: BLOCK_BUCKETS.math.primary,
				colourSecondary: BLOCK_BUCKETS.math.secondary,
				colourTertiary: BLOCK_BUCKETS.math.tertiary
			},
			text_blocks: {
				colourPrimary: BLOCK_BUCKETS.text.primary,
				colourSecondary: BLOCK_BUCKETS.text.secondary,
				colourTertiary: BLOCK_BUCKETS.text.tertiary
			},
			variable_blocks: {
				colourPrimary: BLOCK_BUCKETS.variables.primary,
				colourSecondary: BLOCK_BUCKETS.variables.secondary,
				colourTertiary: BLOCK_BUCKETS.variables.tertiary
			},
			engine_blocks: {
				colourPrimary: BLOCK_BUCKETS.engine.primary,
				colourSecondary: BLOCK_BUCKETS.engine.secondary,
				colourTertiary: BLOCK_BUCKETS.engine.tertiary
			},
			input_blocks: {
				colourPrimary: BLOCK_BUCKETS.input.primary,
				colourSecondary: BLOCK_BUCKETS.input.secondary,
				colourTertiary: BLOCK_BUCKETS.input.tertiary
			}
		}
	}
);

/**
 * Pick the Blockly theme that matches the current app theme. Only the `warm`
 * variant gets a custom skin — `light` and `dark` use Blockly's stock Classic
 * theme so the existing look is unchanged for those.
 *
 * (A dedicated dark Blockly theme is an explicit followup; mixing the warm
 * palette into dark mode would look muddy.)
 */
export function pickBlocklyTheme(current: BlockQuizTheme): Blockly.Theme {
	if (current === 'warm') return warmBlocklyTheme;
	return Blockly.Themes.Classic;
}
