<script lang="ts">
	import * as Blockly from 'blockly/core';
	import 'blockly/blocks';
	// Locale message bundles for built-in Blockly blocks. The active one is
	// applied below via `applyBlocklyLocale`. Without one of these, built-in
	// blocks render the raw msg key (e.g. "%{BKY_CONTROLS_IF_MSG_IF}").
	import * as En from 'blockly/msg/en';
	import * as De from 'blockly/msg/de';
	import { onDestroy, onMount } from 'svelte';
	import { javascriptGenerator as jG } from 'blockly/javascript';
	import type { BlocklyToolboxConfig, BlocklyConfig } from '$lib/blockly/types';
	import { getDefaultConfig } from '$lib/blockly/BlocklyFactory';
	import { syncCustomBlocklyMsg } from '$lib/blockly/i18n';
	import { pickBlocklyTheme } from '$lib/blockly/warmTheme';
	import { theme as appTheme } from '$lib/theme.svelte';
	import { i18n } from '$lib/i18n/index.svelte';

	const BLOCKLY_MSG: Record<string, unknown> = { en: En, de: De };

	function applyBlocklyLocale(locale: string) {
		Blockly.setLocale((BLOCKLY_MSG[locale] ?? En) as Record<string, string>);
		// Friendlier labels for the prompt block — "input" reads more naturally to
		// learners than Blockly's default "prompt for … with message …".
		Blockly.Msg['TEXT_PROMPT_TYPE_NUMBER'] = locale === 'de' ? 'Zahl eingeben' : 'input number';
		Blockly.Msg['TEXT_PROMPT_TYPE_TEXT'] = locale === 'de' ? 'Text eingeben' : 'input text';
		syncCustomBlocklyMsg();
	}

	applyBlocklyLocale(i18n.locale);

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
	let injectError = $state<string | null>(null);

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
				theme: pickBlocklyTheme(appTheme.current),
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
			injectError = e instanceof Error ? e.message : String(e);
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

	// Re-skin the live workspace whenever the app theme toggles. Blockly's
	// setTheme triggers an internal re-render without re-injecting blocks, so
	// the user's in-progress workspace contents are preserved.
	$effect(() => {
		const next = pickBlocklyTheme(appTheme.current);
		if (workspace && workspace.getTheme() !== next) {
			workspace.setTheme(next);
		}
	});

	// Re-apply the Blockly locale when the app locale changes. New workspaces
	// pick up translated labels; existing ones are remounted by their parents
	// via `{#key i18n.locale}` so their blocks re-register with the new strings.
	$effect(() => {
		applyBlocklyLocale(i18n.locale);
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
	{#if injectError}
		<div class="alert mb-2 alert-error" role="alert">
			<span>Blockly failed to load: {injectError}</span>
		</div>
	{/if}
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
