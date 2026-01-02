<script lang="ts" generics="T extends { id: string }">
	import type { Snippet } from 'svelte';
	import type { LocalizedString } from '$lib/types/exercise';
	import { getLocalized } from '$lib/i18n/index.svelte';
	import { sanitizeHtml } from '$lib/utils/sanitize';

	type Column<T> = {
		key: string;
		label: string;
		render?: (item: T) => string | LocalizedString | { de: string; en: string } | undefined;
		html?: boolean;
		class?: string;
	};

	type Props<T> = {
		items: T[];
		columns: Column<T>[];
		actions?: Snippet<[T]>;
		class?: string;
	};

	let { items, columns, actions, class: className = '' }: Props<T> = $props();

	function renderCell(item: T, column: Column<T>): string {
		const value = column.render ? column.render(item) : (item as Record<string, unknown>)[column.key];

		if (!value) return '';

		// Handle LocalizedString
		if (typeof value === 'object' && 'de' in value && 'en' in value) {
			return getLocalized(value as LocalizedString);
		}

		// Handle other types
		if (typeof value === 'string') {
			return value;
		}

		return String(value);
	}
</script>

<div class="overflow-x-auto {className}">
	<table class="table table-zebra">
		<thead>
			<tr>
				{#each columns as column (column.key)}
					<th class={column.class}>{column.label}</th>
				{/each}
				{#if actions}
					<th class="text-right">Actions</th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#each items as item (item.id)}
				<tr class="hover">
					{#each columns as column (column.key)}
						<td class={column.class}>
							{#if column.html}
								<span>{@html sanitizeHtml(renderCell(item, column))}</span>
							{:else}
								<span>{renderCell(item, column)}</span>
							{/if}
						</td>
					{/each}
					{#if actions}
						<td class="text-right">
							{@render actions(item)}
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

