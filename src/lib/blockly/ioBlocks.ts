import * as Blockly from 'blockly/core';
import { javascriptGenerator as jG, Order } from 'blockly/javascript';
import { localized } from './i18n';

export const IO_INPUT_BLOCKS = ['io_input_text', 'io_input_number'] as const;

const STYLE = 'input_blocks';

type ReporterInit = {
	id: string;
	labelKey: string;
	labelFallback: string;
	tooltipKey: string;
	tooltipFallback: string;
	output: 'String' | 'Number';
};

const REPORTERS: ReporterInit[] = [
	{
		id: 'io_input_text',
		labelKey: 'block_io_input_text',
		labelFallback: 'input',
		tooltipKey: 'block_io_input_text_tooltip',
		tooltipFallback:
			'The next line of input the computer gives you for this check. Use it inside if-blocks, prints, or math.',
		output: 'String'
	},
	{
		id: 'io_input_number',
		labelKey: 'block_io_input_number',
		labelFallback: 'input as number',
		tooltipKey: 'block_io_input_number_tooltip',
		tooltipFallback:
			'The next line of input from the computer, converted to a number. Use it in math or comparisons.',
		output: 'Number'
	}
];

export function registerIoInputBlocks(): void {
	for (const cfg of REPORTERS) {
		Blockly.Blocks[cfg.id] = {
			init(this: Blockly.Block) {
				this.appendDummyInput().appendField(localized(cfg.labelKey, cfg.labelFallback));
				this.setOutput(true, cfg.output);
				this.setStyle(STYLE);
				this.setTooltip(localized(cfg.tooltipKey, cfg.tooltipFallback));
			}
		};
	}

	jG.forBlock['io_input_text'] = () => ['prompt()', Order.FUNCTION_CALL];
	jG.forBlock['io_input_number'] = () => ['Number(prompt())', Order.FUNCTION_CALL];
}

/**
 * Rewrite any legacy `text_prompt_ext` blocks in a Blockly XML root into the
 * new `io_input_text` / `io_input_number` reporters. Strips the mutation,
 * TYPE field, and the now-unused TEXT (prompt message) value slot so the
 * resulting block is a clean leaf reporter.
 */
export function migrateIoInputXml(xmlRoot: Element | null | undefined): void {
	if (!xmlRoot || typeof (xmlRoot as Element).querySelectorAll !== 'function') return;

	const legacy = xmlRoot.querySelectorAll(
		'block[type="text_prompt_ext"], shadow[type="text_prompt_ext"]'
	);

	for (const node of Array.from(legacy)) {
		const typeField = node.querySelector(':scope > field[name="TYPE"]');
		const mutationEl = node.querySelector(':scope > mutation');
		const promptType =
			(typeField?.textContent ?? mutationEl?.getAttribute('type') ?? 'TEXT')
				.trim()
				.toUpperCase();

		const replacementType = promptType === 'NUMBER' ? 'io_input_number' : 'io_input_text';
		node.setAttribute('type', replacementType);

		typeField?.remove();
		mutationEl?.remove();
		node.querySelector(':scope > value[name="TEXT"]')?.remove();
	}
}
