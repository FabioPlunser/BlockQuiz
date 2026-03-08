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
	let scrollbarObserver: MutationObserver | null = null;

	onMount(() => {
		if (!browser) return;
		try {
			workspace = Blockly.inject(blocklyDiv, {
				toolbox: toolboxConfig,
				...config
			});

			// Fix flyout scrollbar persistence issue
			if (workspace) {
				const cleanupScrollbars = () => {
					requestAnimationFrame(() => {
						const flyout = (workspace as any).getFlyout?.();
						if (flyout) {
							const isVisible = flyout.isVisible?.();
							if (!isVisible) {
								// Hide scrollbars when flyout is closed
								const scrollbars = blocklyDiv.querySelectorAll('.blocklyFlyoutScrollbar');
								scrollbars.forEach((sb) => {
									(sb as HTMLElement).style.display = 'none';
									(sb as HTMLElement).style.visibility = 'hidden';
								});
							}
						}
					});
				};

				// Use MutationObserver to watch for flyout visibility changes
				scrollbarObserver = new MutationObserver(() => {
					cleanupScrollbars();
				});

				// Observe the Blockly container for changes
				scrollbarObserver.observe(blocklyDiv, {
					attributes: true,
					attributeFilter: ['style', 'class'],
					subtree: true
				});

				// Initial cleanup
				cleanupScrollbars();
			}
		} catch (e) {
			console.error('Blockly inject failed:', e);
		}

		// Load starter xml if provided
		if (starterXml && workspace) {
			try {
				const xml = Blockly.utils.xml.textToDom(starterXml);
				Blockly.Xml.domToWorkspace(xml, workspace);
			} catch (e) {
				console.error('Failed to load starter XML:', e);
			}
		}
	});
	onDestroy(() => {
		if (scrollbarObserver) {
			scrollbarObserver.disconnect();
		}
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

<div
	bind:this={blocklyDiv}
	class="h-full min-h-64 w-full overflow-hidden rounded border border-base-300 focus:outline-none focus:ring-0"
></div>

<style>
	/* Fix Blockly flyout scrollbar persistence issue */
	/* Hide scrollbars when flyout is not visible */
	:global(.blocklyFlyout[style*="display: none"] .blocklyFlyoutScrollbar),
	:global(.blocklyFlyoutScrollbar[style*="display: none"]) {
		display: none !important;
		visibility: hidden !important;
	}

	/* Fix for SVG elements that might cause scrollbar issues */
	:global(svg[display='none']) {
		display: none !important;
	}

	/* Ensure scrollbars are hidden when parent flyout is hidden */
	:global(.blocklyFlyout:not([style*="display: block"]):not([style*="display: flex"]) .blocklyFlyoutScrollbar) {
		display: none !important;
		visibility: hidden !important;
	}

	/* Remove focus/outline styles that might cause highlighting */
	:global(.blocklyMainBackground),
	:global(.blocklyBlockCanvas),
	:global(.blocklyBubbleCanvas) {
		outline: none !important;
	}

	:global(.blocklyMainBackground:focus),
	:global(.blocklyBlockCanvas:focus),
	:global(.blocklyBubbleCanvas:focus) {
		outline: none !important;
		box-shadow: none !important;
	}
</style>
