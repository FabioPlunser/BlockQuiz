import { describe, it, expect } from 'vitest';
import { describeWorkspace } from './codeReadout';

const wrap = (inner: string) =>
	`<xml xmlns="https://developers.google.com/blockly/xml">${inner}</xml>`;

describe('describeWorkspace', () => {
	it('returns an empty-state line for an empty workspace', () => {
		expect.assertions(2);
		expect(describeWorkspace('', 'en')).toEqual([
			'Your workspace is empty. Drag some blocks in to start building.'
		]);
		expect(describeWorkspace(wrap(''), 'de')).toEqual([
			'Dein Arbeitsbereich ist leer. Ziehe Blöcke hinein, um zu starten.'
		]);
	});

	it('describes a chain of robot grid blocks', () => {
		expect.assertions(1);
		const xml = wrap(
			`<block type="step"><next>
				<block type="turn_left"><next>
					<block type="step"><next>
						<block type="collect"/>
					</next></block>
				</next></block>
			</next></block>`
		);
		expect(describeWorkspace(xml, 'en')).toEqual([
			'Move forward 1 cell',
			'Turn left',
			'Move forward 1 cell',
			'Collect an item here'
		]);
	});

	it('reads the parameter from a parameterized turtle move block', () => {
		expect.assertions(1);
		const xml = wrap(
			`<block type="move">
				<value name="STEPS">
					<shadow type="math_number"><field name="NUM">5</field></shadow>
				</value>
			</block>`
		);
		expect(describeWorkspace(xml, 'en')).toEqual(['Move forward 5 cells']);
	});

	it('localizes turtle pen state', () => {
		expect.assertions(2);
		const upXml = wrap(`<block type="pen"><field name="STATE">up</field></block>`);
		const downXml = wrap(`<block type="pen"><field name="STATE">down</field></block>`);
		expect(describeWorkspace(upXml, 'en')).toEqual(['Raise the pen (stop drawing)']);
		expect(describeWorkspace(downXml, 'de')).toEqual(['Stift senken (zeichnen)']);
	});

	it('indents repeat-loop bodies and reads the count shadow', () => {
		expect.assertions(1);
		const xml = wrap(
			`<block type="controls_repeat_ext">
				<value name="TIMES">
					<shadow type="math_number"><field name="NUM">3</field></shadow>
				</value>
				<statement name="DO">
					<block type="step"><next>
						<block type="turn_right"/>
					</next></block>
				</statement>
			</block>`
		);
		expect(describeWorkspace(xml, 'en')).toEqual([
			'Repeat 3 times:',
			'  Move forward 1 cell',
			'  Turn right'
		]);
	});

	it('emits a localized fallback line for unknown block types', () => {
		expect.assertions(1);
		const xml = wrap(`<block type="some_unknown_type"/>`);
		expect(describeWorkspace(xml, 'en')).toEqual(['(some_unknown_type)']);
	});

	it('flags additional standalone blocks separately from the main chain', () => {
		expect.assertions(1);
		const xml = wrap(
			`<block type="step"/>
			<block type="turn_left"/>`
		);
		expect(describeWorkspace(xml, 'en')).toEqual([
			'Move forward 1 cell',
			'Standalone block (not yet connected):',
			'Turn left'
		]);
	});
});
