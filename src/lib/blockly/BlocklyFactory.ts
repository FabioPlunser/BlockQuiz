import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { javascriptGenerator as jG } from 'blockly/javascript';
import {
	type BlockDef,
	type BlocklyConfig,
	type BlocklyCategoryConfig,
	BlocklyToolboxKind
} from './types';

export function initBlocks(blocks: BlockDef[], prefix: string) {
	for (const block of blocks) {
		const blocklyId = `${prefix}_${block.id}`;
		Blockly.Blocks[blocklyId] = {
			init: function () {
				if (block.args && block.message.length >= 0) {
					for (const arg of block.args) {
						if (arg.type === 'dropdown') {
							this.appendDummyInput()
								.appendField(block.message.replace('%1', ''))
								.appendField(new Blockly.FieldDropdown(arg.options || []), arg.name);
						} else {
							const input = this.appendValueInput(arg.name).appendField(
								block.message.replace('%1', '')
							);

							// Map our arg.type to Blockly connection checks
							if (arg.type === 'number') {
								input.setCheck('Number');
							} else if (arg.type === 'string' || arg.type === 'color') {
								input.setCheck('String');
							} else if (arg.type === 'boolean') {
								input.setCheck('Boolean');
							}
						}
					}
				} else {
					this.appendDummyInput().appendField(block.message);
				}
				this.setPreviousStatement(true);
				this.setNextStatement(true);
				this.setColour(block.color);
				if (block.tooltip) this.setTooltip(block.tooltip);
			}
		};

		jG.forBlock[blocklyId] = function (blockInstance: Blockly.Block) {
			if (!block.args || block.args.length === 0) {
				// No arguments
				return `api.${block.method}();\n`;
			}
			// Build argument values
			const argValues: string[] = [];
			for (const arg of block.args) {
				if (arg.type === 'dropdown') {
					// Get dropdown value
					const value = blockInstance.getFieldValue(arg.name);
					argValues.push(`'${value}'`);
				} else if (arg.type === 'number') {
					// Get number input - will be a math_number block
					const val = jG.valueToCode(blockInstance, arg.name, (jG as any).ORDER_ATOMIC ?? 0);
					argValues.push(val || String(arg.default ?? 0));
				} else if (arg.type === 'string' || arg.type === 'color') {
					// Get string/color input
					const val = jG.valueToCode(blockInstance, arg.name, (jG as any).ORDER_ATOMIC ?? 0);
					argValues.push(val || `'${arg.default ?? ''}'`);
				}
			}

			return `api.${block.method}(${argValues.join(', ')});\n`;
		};
	}
}

// Helper to get toolbox category for blocks. The fourth arg is a Blockly
// `categorystyle` key resolved against the active theme's `categoryStyles`
// map — lets the toolbox colour follow the app theme without per-call hues.
export function getCategoryForBlocks(
	blocks: BlockDef[],
	prefix: string,
	name: string,
	categorystyle = 'engine_category'
): BlocklyCategoryConfig {
	return {
		kind: 'category',
		name,
		categorystyle,
		contents: blocks.map((block) => {
			const blocklyId = `${prefix}_${block.id}`;
			return { kind: 'block', type: blocklyId };
		})
	};
}

export function getCategoryToolBox(
	toolBoxType: BlocklyToolboxKind,
	blocks?: BlockDef[],
	prefix?: string,
	categories?: BlocklyCategoryConfig[]
) {
	if (toolBoxType === BlocklyToolboxKind.CATEGORY) {
		return {
			kind: toolBoxType,
			contents: categories
		};
	} else if (toolBoxType === BlocklyToolboxKind.FLYOUT && blocks) {
		return {
			kind: toolBoxType,
			contents: blocks.map((block) => ({
				kind: 'block',
				type: `${prefix}_${block.id}`
			}))
		};
	}
}

export function getDefaultConfig(): BlocklyConfig {
	return {
		grid: {
			spacing: 20,
			length: 3,
			colour: '#ccc',
			snap: true
		},
		trashcan: true,
		zoom: {
			controls: true,
			wheel: true,
			startScale: 1,
			maxScale: 3,
			minScale: 0.3,
			scaleSpeed: 1.2
		},
		readonly: false
	};
}
