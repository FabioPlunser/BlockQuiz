<script lang="ts">
	import Canvas from './Canvas.svelte';
	import type { ICanvasEngine, Point, DrawMode, TargetPoint } from '$lib/canvas/types';
	import { i18n } from '$lib/i18n/index.svelte';
	import { Target, Route, BrickWall, Trash2, Grid3X3, FlaskConical } from '@lucide/svelte';

	type Props = {
		engine: ICanvasEngine;
		pathOverlay?: Point[];
		targets?: TargetPoint[];
		walls?: Point[];
		onPathChange?: (points: Point[]) => void;
		onTargetChange?: (targets: TargetPoint[]) => void;
		onWallsChange?: (walls: Point[]) => void;
	};

	let {
		engine,
		pathOverlay = $bindable([]),
		targets = $bindable([]),
		walls = $bindable([]),
		onPathChange,
		onTargetChange,
		onWallsChange
	}: Props = $props();

	let showGrid = $state(true);
	let drawMode = $state<DrawMode>(null);
	let gridSize = $state(50);

	// Derived counts for indicators
	let targetCount = $derived(targets.length);
	let pathPointCount = $derived(pathOverlay.length);
	let wallCount = $derived(walls.length);
	let hasPath = $derived(pathOverlay.length > 1);

	function handlePathChange(points: Point[]) {
		pathOverlay = points;
		onPathChange?.(points);
	}

	function handleTargetChange(newTargets: TargetPoint[]) {
		targets = newTargets;
		onTargetChange?.(newTargets);
	}

	function handleWallsChange(newWalls: Point[]) {
		walls = newWalls;
		onWallsChange?.(newWalls);
	}

	function toggleDrawMode(mode: DrawMode) {
		drawMode = drawMode === mode ? null : mode;
	}

	function clearPath() {
		pathOverlay = [];
		onPathChange?.([]);
	}

	function clearTargets() {
		targets = [];
		onTargetChange?.([]);
	}

	function clearWalls() {
		walls = [];
		onWallsChange?.([]);
	}

	function clearAll() {
		clearPath();
		clearTargets();
		clearWalls();
	}
</script>

<div class="flex flex-col gap-4">
	<!-- Toolbar -->
	<div class="flex flex-wrap items-center gap-2 rounded-lg bg-base-200 p-3">
		<!-- Grid Toggle -->
		<button
			class="btn gap-1 btn-sm"
			class:btn-primary={showGrid}
			class:btn-outline={!showGrid}
			onclick={() => (showGrid = !showGrid)}
			title={i18n.canvas_editor_toggle_grid_title}
		>
			<Grid3X3 class="h-4 w-4" />
			<span class="hidden sm:inline">{showGrid ? 'Hide Grid' : 'Show Grid'}</span>
		</button>

		<div class="divider mx-1 divider-horizontal"></div>

		<!-- Draw Mode Selector with counts -->
		<button
			class="btn gap-1 btn-sm"
			class:btn-primary={drawMode === 'path'}
			class:btn-outline={drawMode !== 'path'}
			onclick={() => toggleDrawMode('path')}
			title={i18n.canvas_editor_draw_path_title}
		>
			<Route class="h-4 w-4" />
			<span>Path</span>
			{#if pathPointCount > 0}
				<span class="badge badge-xs badge-success">{pathPointCount}</span>
			{/if}
		</button>

		<button
			class="btn gap-1 btn-sm"
			class:btn-error={drawMode === 'target'}
			class:btn-outline={drawMode !== 'target'}
			onclick={() => toggleDrawMode('target')}
			title={i18n.canvas_editor_place_targets_title}
		>
			<Target class="h-4 w-4" />
			<span>Target</span>
			{#if targetCount > 0}
				<span class="badge badge-xs badge-success">{targetCount}</span>
			{/if}
		</button>

		<button
			class="btn gap-1 btn-sm"
			class:btn-neutral={drawMode === 'wall'}
			class:btn-outline={drawMode !== 'wall'}
			onclick={() => toggleDrawMode('wall')}
			title={i18n.canvas_editor_place_walls_title}
		>
			<BrickWall class="h-4 w-4" />
			<span>Wall</span>
			{#if wallCount > 0}
				<span class="badge badge-xs">{wallCount}</span>
			{/if}
		</button>

		<div class="divider mx-1 divider-horizontal"></div>

		<!-- Clear Buttons -->
		<button
			class="btn gap-1 btn-ghost btn-sm"
			onclick={clearAll}
			title={i18n.canvas_editor_clear_all_title}
			disabled={pathOverlay.length === 0 && targets.length === 0 && walls.length === 0}
		>
			<Trash2 class="h-4 w-4" />
			<span class="hidden sm:inline">Clear All</span>
		</button>
	</div>

	<!-- Status Indicator -->
	{#if drawMode}
		<div class="alert py-2 alert-info">
			<span class="text-sm">
				{#if drawMode === 'path'}
					<Route class="mr-1 inline h-4 w-4" />
					Click to draw waypoints. This creates a <strong>path test</strong> automatically.
				{:else if drawMode === 'target'}
					<Target class="mr-1 inline h-4 w-4" />
					Click to place targets. Each creates a <strong>target test</strong> automatically.
				{:else if drawMode === 'wall'}
					<BrickWall class="mr-1 inline h-4 w-4" />
					Click to place walls. These are obstacles the student must avoid.
				{/if}
			</span>
		</div>
	{/if}

	<!-- Auto-generated Tests Indicator -->
	{#if targetCount > 0 || hasPath}
		<div class="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm">
			<FlaskConical class="h-4 w-4 text-success" />
			<span class="text-success-content">
				<strong>Auto-generated tests:</strong>
				{#if targetCount > 0}
					<span class="ml-1">{targetCount} target test{targetCount > 1 ? 's' : ''}</span>
				{/if}
				{#if targetCount > 0 && hasPath}
					<span class="mx-1">+</span>
				{/if}
				{#if hasPath}
					<span>1 path test ({pathPointCount} waypoints)</span>
				{/if}
			</span>
		</div>
	{/if}

	<!-- Canvas -->
	<Canvas
		{engine}
		editable={true}
		{drawMode}
		{showGrid}
		{gridSize}
		{pathOverlay}
		{targets}
		{walls}
		onPathChange={handlePathChange}
		onTargetChange={handleTargetChange}
		onWallsChange={handleWallsChange}
	/>

	<!-- Element Counts Summary -->
	<div class="flex flex-wrap gap-2 text-xs text-base-content/60">
		{#if targetCount > 0}
			<span class="flex items-center gap-1">
				<Target class="h-3 w-3 text-error" />
				{targetCount} target{targetCount > 1 ? 's' : ''}
			</span>
		{/if}
		{#if pathPointCount > 0}
			<span class="flex items-center gap-1">
				<Route class="h-3 w-3 text-primary" />
				{pathPointCount} path point{pathPointCount > 1 ? 's' : ''}
			</span>
		{/if}
		{#if wallCount > 0}
			<span class="flex items-center gap-1">
				<BrickWall class="h-3 w-3" />
				{wallCount} wall{wallCount > 1 ? 's' : ''}
			</span>
		{/if}
		{#if targetCount === 0 && pathPointCount === 0 && wallCount === 0}
			<span>Canvas is empty. Use the tools above to add elements.</span>
		{/if}
	</div>
</div>
