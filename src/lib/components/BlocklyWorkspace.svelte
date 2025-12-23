<script lang="ts">
	import * as Blockly from 'blockly';
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { javascriptGenerator as jG } from 'blockly/javascript';
	import type { BlocklyToolboxConfig, BlocklyConfig } from '$lib/blockly/types';
	import { getDefaultConfig } from '$lib/blockly/BlocklyFactory';

	let {
		toolboxConfig,
		starterXml = '',
		config = getDefaultConfig()
	}: {
		toolboxConfig: BlocklyToolboxConfig;
		starterXml?: string;
		config?: BlocklyConfig;
	} = $props();
	export { getCode, getXml, clear };

	$inspect(toolboxConfig);

	let blocklyDiv: HTMLDivElement;
	let workspace: Blockly.WorkspaceSvg | null = null;

	onMount(() => {
		if (!browser) return;
		try {
			workspace = Blockly.inject(blocklyDiv, {
				toolbox: toolboxConfig,
				...config
			});
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
