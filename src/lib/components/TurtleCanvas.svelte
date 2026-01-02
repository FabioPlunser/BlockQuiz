<script lang="ts">
	/**
	 * TurtleCanvas - A thin wrapper around Canvas for backward compatibility.
	 * For new code, consider using Canvas directly with a custom actor snippet.
	 */
	import Canvas from './Canvas.svelte';
	import { Turtle } from '$lib/canvas/Turtle.svelte';
	import type { Point, DrawMode, TargetPoint } from '$lib/canvas/types';

	type Props = {
		turtle: Turtle;
		editable?: boolean;
		drawMode?: DrawMode;
		pathOverlay?: Point[];
		apple?: Point | null;
		walls?: Point[];
		activateGrid?: boolean;
		onPathChange?: (points: Point[]) => void;
		onAppleChange?: (apple: Point | null) => void;
		onWallsChange?: (walls: Point[]) => void;
	};

	let {
		turtle = $bindable(new Turtle(400, 400)),
		editable = false,
		drawMode = null,
		pathOverlay = [],
		apple = null,
		walls = [],
		activateGrid = false,
		onPathChange,
		onAppleChange,
		onWallsChange
	}: Props = $props();

	// Convert single apple to targets array
	let targets = $state<TargetPoint[]>(apple ? [{ ...apple, icon: 'apple' }] : []);

	$effect(() => {
		targets = apple ? [{ ...apple, icon: 'apple' }] : [];
	});

	function handleTargetChange(newTargets: TargetPoint[]) {
		targets = newTargets;
		const newApple = newTargets.length > 0 ? { x: newTargets[0].x, y: newTargets[0].y } : null;
		apple = newApple;
		onAppleChange?.(newApple);
	}

	// Map legacy 'apple' drawMode to 'target' for Canvas
	let canvasDrawMode = $derived<DrawMode>((drawMode as string) === 'apple' ? 'target' : drawMode);
</script>

<Canvas
	engine={turtle}
	{editable}
	drawMode={canvasDrawMode}
	{pathOverlay}
	{targets}
	{walls}
	showGrid={activateGrid}
	{onPathChange}
	onTargetChange={handleTargetChange}
	{onWallsChange}
/>
