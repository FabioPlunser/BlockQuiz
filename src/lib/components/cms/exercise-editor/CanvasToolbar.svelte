<script lang="ts">
	import {
		Apple,
		BrickWall,
		Brush,
		EyeOff,
		Flag,
		Grid3X3,
		MousePointerClick,
		Play,
		Trash
	} from '@lucide/svelte';
	import type { DrawMode } from '$lib/canvas/types';
	import { i18n } from '$lib/i18n/index.svelte';

	type Props = {
		showGrid: boolean;
		drawMode: DrawMode;
		pathCount: number;
		targetCount: number;
		wallCount: number;
		hasStart: boolean;
		hasFinish: boolean;
		hasSelection: boolean;
		hideActor?: boolean;
		onClear: () => void;
		onClearAll?: () => void;
		onDeleteSelected: () => void;
		onSelectModeChange: () => void;
	};

	let {
		showGrid = $bindable(),
		drawMode = $bindable(),
		pathCount,
		targetCount,
		wallCount,
		hasStart,
		hasFinish,
		hasSelection,
		hideActor = $bindable(false),
		onClear,
		onClearAll,
		onDeleteSelected,
		onSelectModeChange
	}: Props = $props();

	function toggle(mode: Exclude<DrawMode, null>) {
		drawMode = drawMode === mode ? null : mode;
	}
</script>

<div class="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-base-300 p-2">
	<button
		type="button"
		class="btn gap-1 btn-sm"
		class:btn-primary={showGrid}
		onclick={() => (showGrid = !showGrid)}
	>
		<Grid3X3 size="16" />
		{showGrid ? i18n.cms_canvas_hide_grid : i18n.cms_canvas_show_grid}
	</button>

	<button
		type="button"
		class="btn gap-1 btn-sm"
		class:btn-primary={hideActor}
		onclick={() => (hideActor = !hideActor)}
	>
		<EyeOff size="16" />
		{hideActor
			? (i18n.cms_canvas_show_actor ?? 'Show turtle')
			: (i18n.cms_canvas_hide_actor ?? 'Hide turtle')}
	</button>

	<!--
		TODO: auto-generate a teacher path from start → finish, avoiding walls.
		Earlier prototype used findShortestPath() in $lib/canvas/pathfinding.ts
		to dump cell-center waypoints into pathOverlay, but the result was a
		blocky right-angled route that didn't match how teachers actually draw
		teaching paths. Revisit with smoothing / spline interpolation, or let
		teachers nudge the auto-generated polyline before keeping it.
	-->

	<div class="divider mx-1 divider-horizontal"></div>

	<button
		type="button"
		class="btn gap-1 btn-sm"
		class:btn-primary={drawMode === 'path'}
		onclick={() => toggle('path')}
	>
		<Brush size="16" />
		{i18n.cms_canvas_path}
		{#if pathCount > 0}
			<span class="badge badge-xs badge-success">{pathCount}</span>
		{/if}
	</button>
	<button
		type="button"
		class="btn gap-1 btn-sm"
		class:btn-error={drawMode === 'target'}
		onclick={() => toggle('target')}
	>
		<Apple size="16" />
		{i18n.cms_canvas_target}
		{#if targetCount > 0}
			<span class="badge badge-xs badge-success">{targetCount}</span>
		{/if}
	</button>
	<button
		type="button"
		class="btn gap-1 btn-sm"
		class:btn-neutral={drawMode === 'wall'}
		onclick={() => toggle('wall')}
	>
		<BrickWall size="16" />
		{i18n.cms_canvas_wall}
		{#if wallCount > 0}
			<span class="badge badge-xs">{wallCount}</span>
		{/if}
	</button>
	<button
		type="button"
		class="btn gap-1 btn-sm"
		class:btn-success={drawMode === 'start'}
		onclick={() => toggle('start')}
	>
		<Play size="16" />
		{i18n.cms_canvas_start ?? 'Start'}
		{#if hasStart}
			<span class="badge badge-xs badge-success">✓</span>
		{/if}
	</button>
	<button
		type="button"
		class="btn gap-1 btn-sm"
		class:btn-error={drawMode === 'finish'}
		onclick={() => toggle('finish')}
	>
		<Flag size="16" />
		{i18n.cms_canvas_finish ?? 'Finish'}
		{#if hasFinish}
			<span class="badge badge-xs badge-success">✓</span>
		{/if}
	</button>
	<button
		type="button"
		class="btn gap-1 btn-sm"
		class:btn-warning={drawMode === 'select'}
		onclick={() => {
			toggle('select');
			onSelectModeChange();
		}}
	>
		<MousePointerClick size="16" />
		{i18n.cms_canvas_select}
	</button>
	{#if drawMode === 'select' && hasSelection}
		<button type="button" class="btn gap-1 btn-sm btn-error" onclick={onDeleteSelected}>
			<Trash size="16" />
			{i18n.cms_canvas_delete_selected}
		</button>
	{/if}

	<div class="flex-1"></div>

	<button
		type="button"
		class="btn gap-1 btn-ghost btn-sm"
		onclick={onClear}
		title={i18n.cms_canvas_clear_path_hint ?? 'Removes only the dashed teacher path; walls, apples, start and finish stay.'}
	>
		<Trash size="16" />
		{i18n.cms_canvas_clear_path ?? 'Clear path'}
	</button>
	{#if onClearAll}
		<button
			type="button"
			class="btn gap-1 btn-ghost btn-sm text-error"
			onclick={() => onClearAll?.()}
			title={i18n.cms_canvas_clear_all_hint ??
				'Removes the path, walls, apples, start and finish. The exercise stays.'}
		>
			<Trash size="16" />
			{i18n.cms_canvas_clear_all ?? 'Clear all'}
		</button>
	{/if}
</div>

{#if drawMode}
	<div class="mb-4 alert py-2 alert-info">
		<span class="text-sm">
			{#if drawMode === 'path'}
				<Brush class="mr-1 inline h-4 w-4" />
				{i18n.cms_canvas_path_hint}
			{:else if drawMode === 'target'}
				<Apple class="mr-1 inline h-4 w-4" />
				{i18n.cms_canvas_target_hint}
			{:else if drawMode === 'wall'}
				<BrickWall class="mr-1 inline h-4 w-4" />
				{i18n.cms_canvas_wall_hint}
			{:else if drawMode === 'start'}
				<Play class="mr-1 inline h-4 w-4" />
				{i18n.cms_canvas_start_hint ?? 'Click a cell to place the start position. There can only be one.'}
			{:else if drawMode === 'finish'}
				<Flag class="mr-1 inline h-4 w-4" />
				{i18n.cms_canvas_finish_hint ??
					'Click a cell to place the finish. The path from start to finish must be clear.'}
			{:else if drawMode === 'select'}
				<MousePointerClick class="mr-1 inline h-4 w-4" />
				{i18n.cms_canvas_select_hint}
			{/if}
		</span>
	</div>
{/if}
