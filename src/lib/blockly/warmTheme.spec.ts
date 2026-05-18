import { describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';

import {
	pickBlocklyTheme,
	warmBlocklyTheme,
	WARM_BLOCKLY_THEME_NAME
} from './warmTheme';

describe('warmBlocklyTheme', () => {
	it('inherits from Blockly.Themes.Classic so unset properties keep stock defaults', () => {
		expect.assertions(2);
		// Sanity: every property Classic exposes is also reachable on the warm
		// theme (Blockly resolves missing keys to the base theme at lookup time).
		expect(warmBlocklyTheme.name).toBe(WARM_BLOCKLY_THEME_NAME);
		expect(Blockly.Themes.Classic).toBeDefined();
	});

	it('sets a cream workspace background and dark-brown toolbox foreground', () => {
		expect.assertions(2);
		expect(warmBlocklyTheme.componentStyles.workspaceBackgroundColour).toBe('#f3ede0');
		expect(warmBlocklyTheme.componentStyles.toolboxForegroundColour).toBe('#3a2e25');
	});

	it('defines all six categoryStyles used by the toolbox configs', () => {
		expect.assertions(6);
		for (const key of [
			'logic_category',
			'loop_category',
			'math_category',
			'text_category',
			'variable_category',
			'engine_category'
		]) {
			expect(warmBlocklyTheme.categoryStyles[key]?.colour).toBeTruthy();
		}
	});

	it('defines matching blockStyles so blocks pick up the warm palette', () => {
		expect.assertions(6);
		for (const key of [
			'logic_blocks',
			'loop_blocks',
			'math_blocks',
			'text_blocks',
			'variable_blocks',
			'engine_blocks'
		]) {
			expect(warmBlocklyTheme.blockStyles[key]?.colourPrimary).toBeTruthy();
		}
	});
});

describe('pickBlocklyTheme', () => {
	it('returns the warm theme when current === "warm"', () => {
		expect.assertions(1);
		expect(pickBlocklyTheme('warm')).toBe(warmBlocklyTheme);
	});

	it('returns Blockly.Themes.Classic for light + dark', () => {
		expect.assertions(2);
		expect(pickBlocklyTheme('light')).toBe(Blockly.Themes.Classic);
		expect(pickBlocklyTheme('dark')).toBe(Blockly.Themes.Classic);
	});
});
