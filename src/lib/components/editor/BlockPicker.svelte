<script lang="ts">
	import { LOGIC_BLOCKS, LOOP_BLOCKS, MATH_BLOCKS, TEXT_BLOCKS } from '$lib/blockly/presets';
	import { IO_INPUT_BLOCKS } from '$lib/blockly/ioBlocks';
	import { Turtle } from '$lib/canvas/Turtle.svelte';
	import { Robot } from '$lib/canvas/Robot.svelte';
	import type { ExerciseType } from '$lib/types/exercise';
	import { i18n } from '$lib/i18n/index.svelte';
	import { localized, BUILTIN_BLOCK_LABEL_KEYS } from '$lib/blockly/i18n';
	import { CircleHelp } from '@lucide/svelte';

	let {
		selectedBlocks = $bindable([]),
		exerciseType = 'turtle'
	}: {
		selectedBlocks: string[];
		exerciseType: ExerciseType;
	} = $props();

	const turtle = new Turtle(400, 400);
	const robot = new Robot(400, 400);

	type BlockOption = {
		id: string;
		label: string;
		searchText: string;
		locked?: boolean;
		helpKey?: string;
	};

	type BlockCategory = {
		id: string;
		name: string;
		description: string;
		group: string;
		colorClass: string;
		blocks: BlockOption[];
	};

	type BlockPreset = {
		id: string;
		label: string;
		description: string;
		blocks: string[];
	};

	let search = $state('');
	let helpOpen = $state(false);

	function formatBuiltinBlockName(id: string): string {
		const key = BUILTIN_BLOCK_LABEL_KEYS[id];
		if (key) return localized(key, key);
		return id
			.replace(/_/g, ' ')
			.replace(/controls /i, '')
			.replace(/logic /i, '')
			.replace(/math /i, '')
			.replace(/text /i, '')
			.trim()
			.replace(/\b\w/g, (letter) => letter.toUpperCase());
	}

	function formatEngineBlockName(messageKey: string, fallbackId: string): string {
		// `BlockDef.message` is an i18n key; resolve it to the current locale.
		const label = localized(messageKey, messageKey);
		const cleaned = label.replace(/%\d+/g, '').replace(/\s+/g, ' ').trim();
		return cleaned
			? cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase())
			: formatBuiltinBlockName(fallbackId);
	}

	function buildEngineCategories(): BlockCategory[] {
		if (exerciseType === 'io') {
			return [];
		}

		const engineBlocks =
			exerciseType === 'turtle'
				? turtle.blockDefs.map((block) => ({
						id: block.id,
						label: formatEngineBlockName(block.message, block.id)
					}))
				: robot.blockDefs.map((block) => ({
						id: block.id,
						label: formatEngineBlockName(block.message, block.id)
					}));

		if (engineBlocks.length === 0) {
			return [];
		}

		const movement = engineBlocks.filter((block) => ['move', 'turn'].includes(block.id));
		const drawing = engineBlocks.filter((block) => !['move', 'turn'].includes(block.id));
		const actorName = exerciseType === 'turtle' ? i18n.toolbox_turtle : i18n.toolbox_robot;
		const categories: BlockCategory[] = [];

		if (movement.length > 0) {
			categories.push({
				id: `${exerciseType}-movement`,
				name:
					exerciseType === 'turtle'
						? i18n.cms_blockpicker_turtle_movement
						: i18n.cms_blockpicker_robot_movement,
				description:
					exerciseType === 'turtle'
						? i18n.cms_blockpicker_turtle_movement_desc
						: i18n.cms_blockpicker_robot_movement_desc,
				group: i18n.cms_blockpicker_group_character,
				colorClass: exerciseType === 'turtle' ? 'bg-emerald-500' : 'bg-sky-500',
				blocks: movement.map((block) => ({
					...block,
					searchText: `${block.label} ${block.id} ${actorName} movement`.toLowerCase()
				}))
			});
		}

		if (drawing.length > 0) {
			categories.push({
				id: `${exerciseType}-extras`,
				name:
					exerciseType === 'turtle'
						? i18n.cms_blockpicker_turtle_extras
						: i18n.cms_blockpicker_robot_extras,
				description:
					exerciseType === 'turtle'
						? i18n.cms_blockpicker_turtle_extras_desc
						: i18n.cms_blockpicker_robot_extras_desc,
				group: i18n.cms_blockpicker_group_character,
				colorClass: 'bg-orange-500',
				blocks: drawing.map((block) => ({
					...block,
					searchText: `${block.label} ${block.id} ${actorName} extras`.toLowerCase()
				}))
			});
		}

		return categories;
	}

	function buildIoInputCategory(): BlockCategory {
		const name = i18n.toolbox_input;
		return {
			id: 'io-input',
			name,
			description: i18n.cms_blockpicker_io_input_desc,
			group: i18n.cms_blockpicker_group_thinking,
			colorClass: 'bg-sky-500',
			blocks: IO_INPUT_BLOCKS.map((blockId) => {
				const label = formatBuiltinBlockName(blockId);
				return {
					id: blockId,
					label,
					searchText: `${label} ${blockId} ${name}`.toLowerCase(),
					locked: true,
					helpKey: 'cms_blockpicker_io_input_help_body'
				};
			})
		};
	}

	const lockedIds = $derived(
		new Set<string>(exerciseType === 'io' ? IO_INPUT_BLOCKS : [])
	);

	function withLockedIds(ids: string[]): string[] {
		return [...new Set([...ids, ...lockedIds])];
	}

	// Always keep locked I/O blocks present in the selection. This is also a
	// safety net for legacy exercises whose stored toolbox never included them.
	$effect(() => {
		if (lockedIds.size === 0) return;
		const missing = [...lockedIds].some((id) => !selectedBlocks.includes(id));
		if (missing) selectedBlocks = withLockedIds(selectedBlocks);
	});

	function buildBuiltinCategory(
		id: string,
		name: string,
		description: string,
		colorClass: string,
		blocks: string[]
	): BlockCategory {
		return {
			id,
			name,
			description,
			group: i18n.cms_blockpicker_group_thinking,
			colorClass,
			blocks: blocks.map((blockId) => {
				const label = formatBuiltinBlockName(blockId);
				return {
					id: blockId,
					label,
					searchText: `${label} ${blockId} ${name}`.toLowerCase()
				};
			})
		};
	}

	function getCategories(): BlockCategory[] {
		const ioInput = exerciseType === 'io' ? [buildIoInputCategory()] : [];
		return [
			...ioInput,
			...buildEngineCategories(),
			buildBuiltinCategory(
				'logic',
				i18n.toolbox_logic,
				i18n.cms_blockpicker_logic_desc,
				'bg-violet-500',
				LOGIC_BLOCKS
			),
			buildBuiltinCategory(
				'loops',
				i18n.toolbox_loops,
				i18n.cms_blockpicker_loops_desc,
				'bg-teal-500',
				LOOP_BLOCKS
			),
			buildBuiltinCategory(
				'math',
				i18n.toolbox_math,
				i18n.cms_blockpicker_math_desc,
				'bg-rose-500',
				MATH_BLOCKS
			),
			buildBuiltinCategory(
				'text',
				i18n.toolbox_text,
				i18n.cms_blockpicker_text_desc,
				'bg-amber-500',
				TEXT_BLOCKS
			)
		];
	}

	function getPresets(categories: BlockCategory[]): BlockPreset[] {
		const availableIds = new Set(
			categories.flatMap((category) => category.blocks.map((block) => block.id))
		);
		const engineIds = categories
			.filter((category) => category.group === 'Character blocks')
			.flatMap((category) => category.blocks.map((block) => block.id));

		const filterAvailable = (ids: string[]) =>
			[...new Set(ids)].filter((id) => availableIds.has(id));

		if (exerciseType === 'io') {
			return [
				{
					id: 'beginner-io',
					label: i18n.cms_blockpicker_preset_beginner_io_label,
					description: i18n.cms_blockpicker_preset_beginner_io_desc,
					blocks: filterAvailable([...TEXT_BLOCKS, 'math_number'])
				},
				{
					id: 'challenge',
					label: i18n.cms_blockpicker_preset_challenge_label,
					description: i18n.cms_blockpicker_preset_challenge_desc,
					blocks: filterAvailable([
						...TEXT_BLOCKS,
						...LOGIC_BLOCKS,
						...LOOP_BLOCKS,
						'math_number',
						'math_arithmetic'
					])
				},
				{
					id: 'everything',
					label: i18n.cms_blockpicker_preset_everything_label,
					description: i18n.cms_blockpicker_preset_everything_desc,
					blocks: filterAvailable(
						categories.flatMap((category) => category.blocks.map((block) => block.id))
					)
				}
			];
		}

		return [
			{
				id: 'starter',
				label: i18n.cms_blockpicker_preset_starter_label,
				description: i18n.cms_blockpicker_preset_starter_desc,
				blocks: filterAvailable([...engineIds, 'controls_repeat_ext', 'math_number'])
			},
			{
				id: 'challenge',
				label: i18n.cms_blockpicker_preset_challenge_label,
				description: i18n.cms_blockpicker_preset_challenge_desc,
				blocks: filterAvailable([
					...engineIds,
					...LOOP_BLOCKS,
					...LOGIC_BLOCKS,
					'math_number',
					'math_arithmetic'
				])
			},
			{
				id: 'everything',
				label: i18n.cms_blockpicker_preset_everything_label,
				description: i18n.cms_blockpicker_preset_everything_desc,
				blocks: filterAvailable(
					categories.flatMap((category) => category.blocks.map((block) => block.id))
				)
			}
		];
	}

	function toggleBlock(id: string, checked: boolean) {
		if (lockedIds.has(id)) {
			// Locked rows stay selected regardless of UI toggling.
			selectedBlocks = withLockedIds(selectedBlocks);
			return;
		}
		if (checked) {
			selectedBlocks = withLockedIds([...selectedBlocks, id]);
			return;
		}

		selectedBlocks = withLockedIds(selectedBlocks.filter((blockId) => blockId !== id));
	}

	function setSelectedBlocks(nextIds: string[]) {
		selectedBlocks = withLockedIds(nextIds);
	}

	function selectCategory(category: BlockCategory) {
		setSelectedBlocks([...selectedBlocks, ...category.blocks.map((block) => block.id)]);
	}

	function clearCategory(category: BlockCategory) {
		const ids = new Set(
			category.blocks.filter((block) => !block.locked).map((block) => block.id)
		);
		selectedBlocks = withLockedIds(selectedBlocks.filter((blockId) => !ids.has(blockId)));
	}

	function applyPreset(preset: BlockPreset) {
		setSelectedBlocks(preset.blocks);
	}

	const categories = $derived(getCategories());
	const presets = $derived(getPresets(categories));
	const totalBlockCount = $derived(categories.flatMap((category) => category.blocks).length);
	const blockLookup = $derived.by(() => {
		const lookup: Record<string, string> = {};
		for (const category of categories) {
			for (const block of category.blocks) {
				lookup[block.id] = block.label;
			}
		}
		return lookup;
	});
	const selectedSummary = $derived(
		selectedBlocks.map((id) => ({ id, label: blockLookup[id] ?? formatBuiltinBlockName(id) }))
	);
	const visibleCategories = $derived.by(() => {
		const query = search.trim().toLowerCase();
		if (!query) {
			return categories;
		}

		return categories
			.map((category) => ({
				...category,
				blocks: category.blocks.filter(
					(block) =>
						block.searchText.includes(query) ||
						category.name.toLowerCase().includes(query) ||
						category.group.toLowerCase().includes(query)
				)
			}))
			.filter((category) => category.blocks.length > 0);
	});
</script>

<div class="space-y-4">
	<section class="rounded-xl border border-base-300 bg-base-200 p-4">
		<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
			<div class="space-y-2">
				<h3 class="text-base font-semibold">{i18n.cms_blockpicker_title}</h3>
				<p class="max-w-2xl text-sm text-base-content/70">
					{i18n.cms_blockpicker_hint}
				</p>
				<div class="flex flex-wrap items-center gap-2 text-sm text-base-content/70">
					<span class="badge badge-outline"
						>{selectedBlocks.length} {i18n.cms_blockpicker_selected}</span
					>
					<span class="badge badge-outline">{totalBlockCount} {i18n.cms_blockpicker_available}</span
					>
				</div>
			</div>

			<label class="form-control w-full max-w-md gap-2">
				<span class="label-text text-sm font-medium">{i18n.cms_blockpicker_search_label}</span>
				<input
					type="search"
					class="input-bordered input w-full"
					placeholder={i18n.cms_blockpicker_search_placeholder}
					bind:value={search}
				/>
			</label>
		</div>

		<div class="mt-4 space-y-2">
			<div class="text-sm font-medium">{i18n.cms_blockpicker_presets_title}</div>
			<div class="grid gap-2 md:grid-cols-3">
				{#each presets as preset (preset.id)}
					<button
						type="button"
						class="rounded-xl border border-base-300 bg-base-100 p-3 text-left transition hover:border-primary/40 hover:bg-base-100"
						onclick={() => applyPreset(preset)}
					>
						<div class="font-medium">{preset.label}</div>
						<div class="mt-1 text-sm text-base-content/70">{preset.description}</div>
						<div class="mt-2 text-xs text-base-content/50">{preset.blocks.length} blocks</div>
					</button>
				{/each}
			</div>
		</div>

		<div class="mt-4 flex flex-wrap gap-2">
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				onclick={() =>
					setSelectedBlocks(
						categories.flatMap((category) => category.blocks.map((block) => block.id))
					)}
			>
				{i18n.cms_blockpicker_select_all}
			</button>
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => setSelectedBlocks([])}>
				{i18n.cms_blockpicker_clear}
			</button>
		</div>

		<div class="mt-4 space-y-2">
			<div class="text-sm font-medium">{i18n.cms_blockpicker_selected_summary}</div>
			{#if selectedSummary.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each selectedSummary as block (block.id)}
						<button
							type="button"
							class="badge gap-2 badge-outline px-3 py-3"
							onclick={() => toggleBlock(block.id, false)}
							aria-label={i18n.cms_blockpicker_remove_selected.replace('{name}', block.label)}
						>
							<span>{block.label}</span>
							<span aria-hidden="true">x</span>
						</button>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-base-content/60">{i18n.cms_blockpicker_none_selected}</p>
			{/if}
		</div>
	</section>

	<div class="space-y-4">
		{#if visibleCategories.length > 0}
			{#each visibleCategories as category (category.id)}
				<section class="rounded-xl border border-base-300 bg-base-100 p-4">
					<div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
						<div class="space-y-2">
							<div class="flex flex-wrap items-center gap-2">
								<span class={`h-3 w-3 rounded-full ${category.colorClass}`}></span>
								<span class="badge badge-outline badge-sm">{category.group}</span>
								<span class="badge badge-ghost badge-sm">
									{category.blocks.filter((block) => selectedBlocks.includes(block.id))
										.length}/{category.blocks.length}
								</span>
							</div>
							<div>
								<h4 class="text-base font-semibold">{category.name}</h4>
								<p class="text-sm text-base-content/70">{category.description}</p>
							</div>
						</div>

						<div class="flex flex-wrap gap-2">
							<button
								type="button"
								class="btn btn-ghost btn-sm"
								onclick={() => selectCategory(category)}
							>
								{i18n.cms_blockpicker_category_select}
							</button>
							<button
								type="button"
								class="btn btn-ghost btn-sm"
								onclick={() => clearCategory(category)}
							>
								{i18n.cms_blockpicker_category_clear}
							</button>
						</div>
					</div>

					<div class="mt-4 grid gap-2 sm:grid-cols-2">
						{#each category.blocks as block (block.id)}
							{@const selected = selectedBlocks.includes(block.id)}
							<label
								class={[
									'flex items-start gap-3 rounded-xl border p-3 transition',
									block.locked
										? 'cursor-default border-primary/30 bg-primary/5'
										: 'cursor-pointer',
									!block.locked && selected
										? 'border-primary bg-primary/10'
										: !block.locked
											? 'border-base-300 bg-base-100 hover:border-base-content/20'
											: ''
								]}
							>
								<input
									type="checkbox"
									class="checkbox mt-0.5 checkbox-sm"
									checked={selected}
									disabled={block.locked}
									onchange={(event) => toggleBlock(block.id, event.currentTarget.checked)}
								/>
								<span class="min-w-0 flex-1">
									<span class="flex items-center gap-2">
										<span class="block font-medium">{block.label}</span>
										{#if block.locked}
											<span class="badge badge-primary badge-xs"
												>{i18n.cms_blockpicker_locked_badge}</span
											>
										{/if}
									</span>
									<span class="block text-xs text-base-content/55">{block.id}</span>
								</span>
								{#if block.locked}
									<button
										type="button"
										class="btn btn-circle btn-ghost btn-xs"
										aria-label={i18n.cms_blockpicker_io_input_help_title}
										onclick={(event) => {
											event.preventDefault();
											helpOpen = true;
										}}
									>
										<CircleHelp class="h-4 w-4" aria-hidden="true" />
									</button>
								{/if}
							</label>
						{/each}
					</div>
				</section>
			{/each}
		{:else}
			<div
				class="rounded-xl border border-dashed border-base-300 bg-base-100 p-6 text-center text-sm text-base-content/60"
			>
				{i18n.cms_blockpicker_no_matches}
			</div>
		{/if}
	</div>
</div>

{#if helpOpen}
	<div
		class="modal modal-open"
		role="dialog"
		aria-modal="true"
		aria-labelledby="block-picker-help-title"
	>
		<div class="modal-box max-w-lg">
			<h3 id="block-picker-help-title" class="text-lg font-semibold">
				{i18n.cms_blockpicker_io_input_help_title}
			</h3>
			<p class="mt-3 whitespace-pre-line text-sm text-base-content/80">
				{i18n.cms_blockpicker_io_input_help_body}
			</p>
			<div class="modal-action">
				<button type="button" class="btn btn-primary btn-sm" onclick={() => (helpOpen = false)}>
					{i18n.cms_blockpicker_io_input_help_close}
				</button>
			</div>
		</div>
		<button
			type="button"
			class="modal-backdrop"
			aria-label={i18n.cms_blockpicker_io_input_help_close}
			onclick={() => (helpOpen = false)}
		></button>
	</div>
{/if}
