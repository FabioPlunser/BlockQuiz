<script lang="ts">
	import * as Blockly from 'blockly/core';
	import 'blockly/blocks';
	import { onDestroy, onMount } from 'svelte';
	import { javascriptGenerator as jG } from 'blockly/javascript';
	import type { BlocklyToolboxConfig, BlocklyConfig } from '$lib/blockly/types';
	import { getDefaultConfig } from '$lib/blockly/BlocklyFactory';

	const uid = $props.id();

	let {
		toolboxConfig,
		starterXml = '',
		config = getDefaultConfig(),
		ariaLabel = 'Blockly workspace'
	}: {
		toolboxConfig: BlocklyToolboxConfig;
		starterXml?: string;
		config?: BlocklyConfig;
		ariaLabel?: string;
	} = $props();
	export { getCode, getXml, clear };

	let blocklyDiv: HTMLDivElement;
	let workspace: Blockly.WorkspaceSvg | null = null;
	let scrollbarObserver: MutationObserver | null = null;
	let resizeObserver: ResizeObserver | null = null;

	function updateAccessibility() {
		const injectionDiv = blocklyDiv.querySelector('.injectionDiv');
		if (injectionDiv instanceof HTMLElement) {
			injectionDiv.setAttribute('role', 'region');
			injectionDiv.setAttribute('aria-label', ariaLabel);
			injectionDiv.tabIndex = 0;
		}

		const svg = blocklyDiv.querySelector('.blocklySvg');
		if (svg instanceof SVGElement) {
			svg.setAttribute('aria-label', ariaLabel);
		}
	}

	onMount(() => {
		try {
			workspace = Blockly.inject(blocklyDiv, {
				toolbox: toolboxConfig,
				media: '/blockly-media/',
				...config
			});
			updateAccessibility();
			Blockly.svgResize(workspace);

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

			// Blockly's SVG sizing is computed on inject and does NOT auto-update if
			// the container's width/height changes later (e.g. when a hidden tab
			// becomes visible, or the layout shifts after async data loads). Watch
			// for any size change and tell Blockly to recompute.
			if (workspace && typeof ResizeObserver !== 'undefined') {
				resizeObserver = new ResizeObserver(() => {
					if (!workspace) return;
					try {
						Blockly.svgResize(workspace);
					} catch {
						// Workspace may already be disposed mid-tear-down — ignore.
					}
				});
				resizeObserver.observe(blocklyDiv);
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
		if (resizeObserver) {
			resizeObserver.disconnect();
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

<div class="blockly-host">
	<p id={`${uid}-instructions`} class="sr-only">
		Use the toolbox to choose blocks, then build your program in the workspace.
	</p>
	<div
		bind:this={blocklyDiv}
		class="blockly-shell w-full overflow-hidden rounded-xl border border-base-300 bg-base-100"
		role="region"
		aria-label={ariaLabel}
		aria-describedby={`${uid}-instructions`}
	></div>
</div>

<style>
	/* Fix Blockly flyout scrollbar persistence issue */
	/* Hide scrollbars when flyout is not visible */
	:global(.blocklyFlyout[style*='display: none'] .blocklyFlyoutScrollbar),
	:global(.blocklyFlyoutScrollbar[style*='display: none']) {
		display: none !important;
		visibility: hidden !important;
	}

	/* Fix for SVG elements that might cause scrollbar issues */
	:global(svg[display='none']) {
		display: none !important;
	}

	/* Ensure scrollbars are hidden when parent flyout is hidden */
	:global(
		.blocklyFlyout:not([style*='display: block']):not([style*='display: flex'])
			.blocklyFlyoutScrollbar
	) {
		display: none !important;
		visibility: hidden !important;
	}

	/*
	 * Blockly is a non-flex SVG widget that needs its container to have an
	 * explicit, non-collapsing height. `h-full` only works when a flex/grid
	 * parent supplies a height, which the CMS preview wrapper does not.
	 * Force a fixed minimum so the editor renders consistently in player,
	 * preview, and authoring contexts.
	 */
	.blockly-host {
		display: flex;
		flex-direction: column;
		min-height: 28rem;
		height: 100%;
	}

	.blockly-shell {
		flex: 1 1 auto;
		min-height: 28rem;
		height: 100%;
	}

	.blockly-shell:focus-within {
		outline: 2px solid hsl(var(--p));
		outline-offset: 2px;
	}
</style>
