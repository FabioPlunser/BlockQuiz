<script lang="ts">
	import { ChevronDown, Search, Check, Square, CheckSquare } from '@lucide/svelte';
	import { tick } from 'svelte';

	type Option = { value: string; label: string };

	type Props = {
		options: Option[];
		// Single-select mode (default).
		value?: string;
		// Multi-select mode (opt-in via `multiSelect=true`).
		values?: string[];
		multiSelect?: boolean;
		// Values that appear pre-selected but cannot be toggled (e.g. IdP-managed).
		disabledValues?: string[];
		// Optional suffix per option value, e.g. "(IdP)" — appended to the label.
		optionBadges?: Record<string, string>;
		placeholder?: string;
		searchPlaceholder?: string;
		emptyLabel?: string;
		// Single-select only: prepends an "(empty)" option with this label.
		emptyOptionLabel?: string;
		// Multi-select only: label on the footer Done button.
		doneLabel?: string;
		// Multi-select only: pluralised label, e.g. "{n} selected". `{n}` is replaced.
		multiSelectedTemplate?: string;
		buttonClass?: string;
		panelClass?: string;
		disabled?: boolean;
		// Single-select fires on selection. Multi-select fires once on close with the final set.
		onChange?: (value: string) => void;
		onChangeMulti?: (values: string[]) => void;
	};

	let {
		options,
		value = $bindable(''),
		values = $bindable([]),
		multiSelect = false,
		disabledValues = [],
		optionBadges = {},
		placeholder = 'Select…',
		searchPlaceholder = 'Search…',
		emptyLabel = 'No matches',
		emptyOptionLabel,
		doneLabel = 'Done',
		multiSelectedTemplate = '{n} selected',
		buttonClass = 'select-bordered select w-64 text-left',
		panelClass = '',
		disabled = false,
		onChange,
		onChangeMulti
	}: Props = $props();

	let isOpen = $state(false);
	let search = $state('');
	let buttonEl = $state<HTMLButtonElement>();
	let panelEl = $state<HTMLDivElement>();
	let inputEl = $state<HTMLInputElement>();
	let position = $state({ top: 0, left: 0, width: 0, openUp: false });

	// Working copy for multi-select so we only fire onChangeMulti on close.
	let workingValues = $state<string[]>([]);

	const allOptions = $derived<Option[]>(
		emptyOptionLabel !== undefined && !multiSelect
			? [{ value: '', label: emptyOptionLabel }, ...options]
			: options
	);

	const filtered = $derived(
		search.trim()
			? allOptions.filter((opt) => opt.label.toLowerCase().includes(search.trim().toLowerCase()))
			: allOptions
	);

	const disabledSet = $derived(new Set(disabledValues));

	const selectedLabel = $derived.by(() => {
		if (multiSelect) {
			// While the panel is open, reflect the working set so the button updates live.
			const source = isOpen ? workingValues : values;
			if (source.length === 0) return placeholder;
			if (source.length === 1) {
				return allOptions.find((opt) => opt.value === source[0])?.label ?? placeholder;
			}
			return multiSelectedTemplate.replace('{n}', String(source.length));
		}
		return allOptions.find((opt) => opt.value === value)?.label ?? placeholder;
	});

	async function open() {
		if (disabled) return;
		isOpen = true;
		// Snapshot the bound values so toggles don't mutate the parent until close.
		if (multiSelect) workingValues = [...values];
		await tick();
		updatePosition();
		inputEl?.focus();
	}

	function close() {
		if (!isOpen) return;
		if (multiSelect) {
			// Commit the working set in one shot.
			const next = [...workingValues].sort();
			const prev = [...values].sort();
			const changed = next.length !== prev.length || next.some((v, i) => v !== prev[i]);
			values = next;
			if (changed) onChangeMulti?.(next);
		}
		isOpen = false;
		search = '';
	}

	function updatePosition() {
		if (!buttonEl) return;
		const rect = buttonEl.getBoundingClientRect();
		const panelHeight = panelEl?.offsetHeight ?? 320;
		const panelWidth = panelEl?.offsetWidth ?? rect.width;

		const spaceBelow = window.innerHeight - rect.bottom;
		const spaceAbove = rect.top;
		const openUp = spaceBelow < panelHeight + 8 && spaceAbove > spaceBelow;

		let left = rect.left;
		if (left + panelWidth + 8 > window.innerWidth) {
			left = Math.max(8, window.innerWidth - panelWidth - 8);
		}
		if (left < 8) left = 8;

		const top = openUp ? rect.top - panelHeight - 4 : rect.bottom + 4;

		position = { top, left, width: Math.max(rect.width, panelWidth), openUp };
	}

	function select(opt: Option) {
		if (disabledSet.has(opt.value)) return;
		if (multiSelect) {
			const idx = workingValues.indexOf(opt.value);
			if (idx >= 0) workingValues = workingValues.filter((v) => v !== opt.value);
			else workingValues = [...workingValues, opt.value];
			// Keep panel open in multi mode.
		} else {
			value = opt.value;
			onChange?.(opt.value);
			close();
		}
	}

	function isSelected(optValue: string): boolean {
		if (multiSelect) return workingValues.includes(optValue);
		return optValue === value;
	}

	function handleDocClick(event: MouseEvent) {
		const target = event.target as Node;
		if (isOpen && !buttonEl?.contains(target) && !panelEl?.contains(target)) {
			close();
		}
	}

	function handleKey(event: KeyboardEvent) {
		if (!isOpen) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			buttonEl?.focus();
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

<svelte:document onclick={handleDocClick} onkeydown={handleKey} />

<button
	bind:this={buttonEl}
	type="button"
	class={buttonClass}
	{disabled}
	onclick={() => (isOpen ? close() : open())}
>
	<span class="block truncate">{selectedLabel}</span>
	<ChevronDown class="ml-auto h-4 w-4 shrink-0 opacity-60" />
</button>

{#if isOpen}
	<div
		bind:this={panelEl}
		class="fixed z-[100] rounded-box border border-base-300 bg-base-100 shadow-lg {panelClass}"
		style:top="{position.top}px"
		style:left="{position.left}px"
		style:min-width="{position.width}px"
	>
		<div class="border-b border-base-300 p-2">
			<label class="input-bordered input input-sm flex items-center gap-2">
				<Search class="h-4 w-4 opacity-60" />
				<input
					bind:this={inputEl}
					bind:value={search}
					type="text"
					class="grow"
					placeholder={searchPlaceholder}
				/>
			</label>
		</div>
		<ul class="max-h-72 overflow-y-auto p-1">
			{#if filtered.length === 0}
				<li class="px-3 py-2 text-sm opacity-60">{emptyLabel}</li>
			{:else}
				{#each filtered as opt (opt.value)}
					{@const selected = isSelected(opt.value)}
					{@const optDisabled = disabledSet.has(opt.value)}
					<li>
						<button
							type="button"
							disabled={optDisabled}
							title={optDisabled ? emptyLabel : undefined}
							class="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent {selected &&
							!multiSelect
								? 'bg-primary text-primary-content hover:bg-primary'
								: ''}"
							onclick={() => select(opt)}
						>
							{#if multiSelect}
								{#if selected}
									<CheckSquare class="h-4 w-4 shrink-0" />
								{:else}
									<Square class="h-4 w-4 shrink-0 opacity-50" />
								{/if}
							{:else if selected}
								<Check class="h-4 w-4 shrink-0" />
							{:else}
								<span class="w-4 shrink-0"></span>
							{/if}
							<span class="truncate">{opt.label}</span>
							{#if optionBadges[opt.value]}
								<span class="ml-auto text-xs opacity-60">{optionBadges[opt.value]}</span>
							{/if}
						</button>
					</li>
				{/each}
			{/if}
		</ul>
		{#if multiSelect}
			<div class="flex justify-end border-t border-base-300 p-2">
				<button type="button" class="btn btn-sm btn-primary" onclick={close}>
					{doneLabel}
				</button>
			</div>
		{/if}
	</div>
{/if}
