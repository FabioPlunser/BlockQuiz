import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly/core';
import { migrateIoInputXml } from './ioBlocks';

const wrap = (inner: string) =>
	`<xml xmlns="https://developers.google.com/blockly/xml">${inner}</xml>`;

function migrate(xml: string): string {
	const dom = Blockly.utils.xml.textToDom(xml);
	migrateIoInputXml(dom);
	return Blockly.utils.xml.domToText(dom);
}

describe('migrateIoInputXml', () => {
	it('rewrites a TEXT prompt to io_input_text and strips the message slot', () => {
		expect.assertions(2);
		const out = migrate(
			wrap(
				`<block type="text_prompt_ext">
					<mutation type="TEXT"></mutation>
					<field name="TYPE">TEXT</field>
					<value name="TEXT"><shadow type="text"><field name="TEXT">name?</field></shadow></value>
				</block>`
			)
		);
		expect(out).toContain('type="io_input_text"');
		expect(out).not.toContain('text_prompt_ext');
	});

	it('rewrites a NUMBER prompt to io_input_number using the mutation attribute', () => {
		expect.assertions(2);
		const out = migrate(
			wrap(
				`<block type="text_prompt_ext">
					<mutation type="NUMBER"></mutation>
					<value name="TEXT"><shadow type="text"><field name="TEXT">age?</field></shadow></value>
				</block>`
			)
		);
		expect(out).toContain('type="io_input_number"');
		expect(out).not.toContain('<value name="TEXT"');
	});

	it('rewrites a nested text_prompt_ext inside a value slot', () => {
		expect.assertions(2);
		const out = migrate(
			wrap(
				`<block type="variables_set">
					<field name="VAR">x</field>
					<value name="VALUE">
						<block type="text_prompt_ext">
							<mutation type="NUMBER"></mutation>
							<field name="TYPE">NUMBER</field>
						</block>
					</value>
				</block>`
			)
		);
		expect(out).toContain('type="io_input_number"');
		expect(out).toContain('type="variables_set"');
	});

	it('is a no-op when no legacy block is present', () => {
		expect.assertions(1);
		const input = wrap('<block type="text_print"/>');
		expect(migrate(input).replace(/\s/g, '')).toBe(input.replace(/\s/g, ''));
	});
});
