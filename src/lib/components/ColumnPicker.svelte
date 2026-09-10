<script lang="ts" generics="T extends { id: string }">
	import { Columns3, Check } from '@lucide/svelte';
	import { i18n } from '$lib/i18n/index.svelte';
	import { tick } from 'svelte';
	import type { Column } from './DataTable.svelte';

	type Props<T> = {
		columns: Column<T>[];
		visibleColumns: string[];
		onChange?: (columns: string[]) => void;
		class?: string;
	};

	let {
		columns,
		visibleColumns = $bindable(),
		onChange,
		class: className = ''
	}: Props<T> = $props();

	let isOpen = $state(false);
	let buttonEl = $state<HTMLButtonElement>();
	let panelEl = $state<HTMLDivElement>();
	let position = $state({ top: 0, left: 0 });

	function toggleColumn(key: string) {
		if (visibleColumns.includes(key)) {
			if (visibleColumns.length <= 1) return;
			visibleColumns = visibleColumns.filter((k) => k !== key);
		} else {
			visibleColumns = [...visibleColumns, key];
		}
		onChange?.(visibleColumns);
	}

	function selectAll() {
		visibleColumns = columns.filter((c) => !c.hidden).map((c) => c.key);
		onChange?.(visibleColumns);
	}

	async function open() {
		isOpen = true;
		await tick();
		updatePosition();
	}

	function updatePosition() {
		if (!buttonEl) return;
		const rect = buttonEl.getBoundingClientRect();
		const panelHeight = panelEl?.offsetHeight ?? 320;
		const panelWidth = panelEl?.offsetWidth ?? 224;

		const spaceBelow = window.innerHeight - rect.bottom;
		const spaceAbove = rect.top;
		const openUp = spaceBelow < panelHeight + 8 && spaceAbove > spaceBelow;

		let left = rect.left;
		if (left + panelWidth + 8 > window.innerWidth) {
			left = Math.max(8, window.innerWidth - panelWidth - 8);
		}
		if (left < 8) left = 8;

		const top = openUp ? rect.top - panelHeight - 4 : rect.bottom + 4;
		position = { top, left };
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as Node;
		if (isOpen && !buttonEl?.contains(target) && !panelEl?.contains(target)) {
			isOpen = false;
		}
	}

	$effect(() => {
		if (!isOpen) return;
		const onScroll = () => updatePosition();
		window.addEventListener('scroll', onScroll, true);
		window.addEventListener('resize', onScroll);
		return () => {
			window.removeEventListener('scroll', onScroll, true);
			window.removeEventListener('resize', onScroll);
		};
	});
</script>

<svelte:document onclick={handleClickOutside} />

<div class={className}>
	<button
		bind:this={buttonEl}
		class="btn btn-ghost btn-sm"
		onclick={() => (isOpen ? (isOpen = false) : open())}
		title={i18n.column_picker_select_columns_title}
	>
		<Columns3 class="h-6 w-6" />
		<span class="hidden sm:inline">{i18n.column_picker_columns_label}</span>
	</button>

	{#if isOpen}
		<div
			bind:this={panelEl}
			class="fixed z-[100] w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
			style:top="{position.top}px"
			style:left="{position.left}px"
		>
			<div class="mb-2 flex items-center justify-between px-2">
				<span class="text-sm font-medium">{i18n.column_picker_visible_columns}</span>
				<button class="btn btn-ghost btn-xs" onclick={selectAll}>
					{i18n.column_picker_show_all}
				</button>
			</div>
			<div class="divider my-0"></div>
			<ul class="max-h-64 overflow-y-auto">
				{#each columns.filter((c) => !c.hidden) as column (column.key)}
					<li>
						<button
							class="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-base-200"
							onclick={() => toggleColumn(column.key)}
						>
							<span>{column.label}</span>
							{#if visibleColumns.includes(column.key)}
								<Check class="h-4 w-4 text-success" />
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
