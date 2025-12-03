<script lang="ts">
	import * as Blockly from 'blockly';
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { javascriptGenerator as jG } from 'blockly/javascript';
	import '$lib/blockly/turtleBlocks';

	let { toolbox, starterXml = '', readOnly = false } = $props();
	export { getCode, getXml, clear };

	let blocklyDiv: HTMLDivElement;
	let workspace: Blockly.WorkspaceSvg | null = null;

	onMount(() => {
		if (!browser) return;

		// Build categories and filter out empty ones
		const categories = [
			{
				kind: 'category',
				name: 'Turtle',
				colour: 160,
				contents: toolbox
					.filter((b: string) => b.startsWith('turtle_'))
					.map((type: string) => {
						if (type === 'turtle_move') {
							return {
								kind: 'block',
								type,
								inputs: {
									DISTANCE: {
										shadow: { type: 'math_number', fields: { NUM: 100 } }
									}
								}
							};
						}
						if (type === 'turtle_turn') {
							return {
								kind: 'block',
								type,
								inputs: {
									DEGREES: {
										shadow: { type: 'math_number', fields: { NUM: 90 } }
									}
								}
							};
						}
						return { kind: 'block', type };
					})
			},
			{
				kind: 'category',
				name: 'Logic',
				colour: 210,
				contents: toolbox
					.filter((b: string) => b.startsWith('controls') || b.startsWith('logic_'))
					.map((type: string) => ({ kind: 'block', type }))
			},
			{
				kind: 'category',
				name: 'Math',
				colour: 230,
				contents: toolbox
					.filter((b: string) => b.startsWith('math_'))
					.map((type: string) => ({ kind: 'block', type }))
			},
			{
				kind: 'category',
				name: 'Text',
				colour: 160,
				contents: toolbox
					.filter((b: string) => b.startsWith('text_'))
					.map((type: string) => ({ kind: 'block', type }))
			}
		];

		// IMPORTANT: Filter out empty categories!
		const nonEmptyCategories = categories.filter((cat) => cat.contents.length > 0);

		const toolBoxConfig = {
			kind: 'categoryToolbox',
			contents: nonEmptyCategories
		};

		console.log('Blockly toolbox config:', toolBoxConfig); // Debug

		try {
			workspace = Blockly.inject(blocklyDiv, {
				toolbox: toolBoxConfig,
				grid: { spacing: 20, length: 3, colour: '#ccc', snap: true },
				trashcan: true,
				zoom: { controls: true, wheel: true, startScale: 1.0 },
				readOnly
			});
			console.log('Blockly workspace created:', workspace); // Debug
		} catch (e) {
			console.error('Blockly inject failed:', e);
		}

		// Load starter xml if provided
		if (starterXml && workspace) {
			try {
				const xml = Blockly.Xml.textToDom(starterXml);
				Blockly.Xml.domToWorkspace(xml, workspace);
			} catch (e) {
				console.error('Failed to load starter XML:', e);
			}
		}
	});
	onDestroy(() => {
		if (workspace) {
			workspace.dispose();
		}
	});

	function getCode(): string {
		if (!workspace) return '';
		return jG.workspaceToCode(workspace);
	}

	function getXml(): string {
		if (!workspace) return '';
		const xml = Blockly.Xml.workspaceToDom(workspace);
		return Blockly.Xml.domToText(xml); // Don't use .outerHTML!
	}

	function clear(): void {
		if (workspace) {
			workspace.clear();
		}
	}
</script>

<div bind:this={blocklyDiv} class="h-96 w-full rounded border border-base-300" />
