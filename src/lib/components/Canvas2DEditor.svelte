<script lang="ts">
	import Canvas from './Canvas.svelte';
	import type { ICanvasEngine, Point, DrawMode, TargetPoint } from '$lib/canvas/types';

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
			class="btn btn-sm"
			class:btn-primary={showGrid}
			class:btn-outline={!showGrid}
			onclick={() => (showGrid = !showGrid)}
			title="Toggle grid overlay"
		>
			<span class="hidden sm:inline">{showGrid ? 'Hide Grid' : 'Show Grid'}</span>
			<span class="sm:hidden">Grid</span>
		</button>

		<div class="divider divider-horizontal mx-1"></div>

		<!-- Draw Mode Selector -->
		<button
			class="btn btn-sm"
			class:btn-primary={drawMode === 'path'}
			class:btn-outline={drawMode !== 'path'}
			onclick={() => toggleDrawMode('path')}
			title="Draw target path"
		>
			Path
		</button>

		<button
			class="btn btn-sm"
			class:btn-primary={drawMode === 'target'}
			class:btn-outline={drawMode !== 'target'}
			onclick={() => toggleDrawMode('target')}
			title="Place target point (apple/goal)"
		>
			Target
		</button>

		<button
			class="btn btn-sm"
			class:btn-primary={drawMode === 'wall'}
			class:btn-outline={drawMode !== 'wall'}
			onclick={() => toggleDrawMode('wall')}
			title="Place wall"
		>
			Wall
		</button>

		<div class="divider divider-horizontal mx-1"></div>

		<!-- Clear Buttons -->
		<button
			class="btn btn-sm btn-ghost"
			onclick={clearAll}
			title="Clear all"
			disabled={pathOverlay.length === 0 && targets.length === 0 && walls.length === 0}
		>
			Clear All
		</button>
	</div>

	<!-- Status Indicator -->
	{#if drawMode}
		<div class="alert alert-info py-2">
			<span class="text-sm">
				{#if drawMode === 'path'}
					📝 Click on the canvas to draw a path. The student should follow this path.
				{:else if drawMode === 'target'}
					🎯 Click on the canvas to place target points. The student should reach these points.
				{:else if drawMode === 'wall'}
					🧱 Click on the canvas to place walls. These block the student's path.
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
</div>
