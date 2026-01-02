<script lang="ts">
	import { LOGIC_BLOCKS, LOOP_BLOCKS, MATH_BLOCKS, TEXT_BLOCKS } from '$lib/blockly/presets';
	import { Turtle } from '$lib/canvas/Turtle.svelte';
	import { Robot } from '$lib/canvas/Robot.svelte';
	import type { ExerciseType } from '$lib/types/exercise';

	let {
		selectedBlocks = $bindable([]),
		exerciseType = 'turtle'
	}: {
		selectedBlocks: string[];
		exerciseType: ExerciseType;
	} = $props();

	// Get engine-specific blocks
	const turtle = new Turtle(400, 400);
	const robot = new Robot(400, 400);

	interface BlockCategory {
		name: string;
		color: string;
		blocks: { id: string; label: string }[];
	}

	function getCategories(): BlockCategory[] {
		const categories: BlockCategory[] = [];

		// Engine-specific blocks
		if (exerciseType === 'turtle') {
			categories.push({
				name: 'Turtle',
				color: 'bg-green-500',
				blocks: turtle.blockDefs.map((b) => ({ id: b.id, label: b.id }))
			});
		} else if (exerciseType === 'robot') {
			categories.push({
				name: 'Robot',
				color: 'bg-blue-500',
				blocks: robot.blockDefs.map((b) => ({ id: b.id, label: b.id }))
			});
		}

		// Built-in Blockly blocks
		categories.push(
			{
				name: 'Logic',
				color: 'bg-indigo-500',
				blocks: LOGIC_BLOCKS.map((id) => ({ id, label: formatBlockName(id) }))
			},
			{
				name: 'Loops',
				color: 'bg-teal-500',
				blocks: LOOP_BLOCKS.map((id) => ({ id, label: formatBlockName(id) }))
			},
			{
				name: 'Math',
				color: 'bg-purple-500',
				blocks: MATH_BLOCKS.map((id) => ({ id, label: formatBlockName(id) }))
			},
			{
				name: 'Text',
				color: 'bg-amber-500',
				blocks: TEXT_BLOCKS.map((id) => ({ id, label: formatBlockName(id) }))
			}
		);

		return categories;
	}

	function formatBlockName(id: string): string {
		return id
			.replace(/_/g, ' ')
			.replace(/controls /i, '')
			.replace(/logic /i, '')
			.replace(/math /i, '')
			.replace(/text /i, '')
			.trim();
	}

	function toggleBlock(id: string, checked: boolean) {
		if (checked) {
			selectedBlocks = [...new Set([...selectedBlocks, id])];
		} else {
			selectedBlocks = selectedBlocks.filter((b) => b !== id);
		}
	}

	function selectAll(category: BlockCategory) {
		const ids = category.blocks.map((b) => b.id);
		selectedBlocks = [...new Set([...selectedBlocks, ...ids])];
	}

	function deselectAll(category: BlockCategory) {
		const ids = new Set(category.blocks.map((b) => b.id));
		selectedBlocks = selectedBlocks.filter((b) => !ids.has(b));
	}

	function selectAllBlocks() {
		const allIds = getCategories().flatMap((c) => c.blocks.map((b) => b.id));
		selectedBlocks = [...new Set(allIds)];
	}

	function deselectAllBlocks() {
		selectedBlocks = [];
	}

	let categories = $derived(getCategories());
</script>

<div class="block-picker">
	<div class="mb-3 flex items-center justify-between">
		<div class="flex gap-2">
			<button type="button" class="btn btn-ghost" onclick={selectAllBlocks}> Select All </button>
			<button type="button" class="btn btn-ghost" onclick={deselectAllBlocks}> Clear All </button>
		</div>
	</div>

	<div class="mb-3 text-sm text-base-content/60">
		Selected: {selectedBlocks.length} blocks
	</div>

	<div class="space-y-4">
		{#each categories as category (category.name)}
			<div class="card bg-base-200">
				<div class="card-body p-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class={`h-3 w-3 rounded ${category.color}`}></span>
							<h4 class="text-sm font-medium">{category.name}</h4>
							<span class="badge badge-ghost badge-sm">
								{category.blocks.filter((b) => selectedBlocks.includes(b.id)).length}/{category
									.blocks.length}
							</span>
						</div>
						<div class="flex gap-1">
							<button
								type="button"
								class="btn btn-ghost btn-xs"
								onclick={() => selectAll(category)}
							>
								All
							</button>
							<button
								type="button"
								class="btn btn-ghost btn-xs"
								onclick={() => deselectAll(category)}
							>
								None
							</button>
						</div>
					</div>

					<div class="mt-2 flex flex-wrap gap-2">
						{#each category.blocks as block (block.id)}
							<label
								class="badge cursor-pointer badge-lg transition-all select-none"
								class:badge-primary={selectedBlocks.includes(block.id)}
								class:badge-outline={!selectedBlocks.includes(block.id)}
							>
								<input
									type="checkbox"
									class="hidden"
									checked={selectedBlocks.includes(block.id)}
									onchange={(e) => toggleBlock(block.id, e.currentTarget.checked)}
								/>
								{block.label}
							</label>
						{/each}
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
</style>
