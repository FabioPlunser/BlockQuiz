<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { Turtle } from '$lib/canvas/Turtle.svelte';
	import type { Point } from '$lib/canvas/types';
	import { watch } from 'runed';

	type DrawMode = 'path' | 'apple' | 'wall' | null;

	type Props = {
		turtle: Turtle;
		editable?: boolean;
		drawMode?: DrawMode;
		pathOverlay?: Point[];
		apple?: Point | null;
		walls?: Point[];
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
		onPathChange,
		onAppleChange,
		onWallsChange
	}: Props = $props();

let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null;
	let turtleX = $derived(turtle.state.x);
	let turtleY = $derived(turtle.state.y);
	let turtleAngle = $derived(turtle.state.angle);
	const cellSize = 50;
let dragPoint: Point | null = null;

	onMount(() => {
		if (!browser) return;
		ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, turtle.width, turtle.height);
		drawTurtle();
	});

	function drawTurtle() {
		if (!browser || !ctx) return;

		// Clear canvas
		ctx.clearRect(0, 0, turtle.width, turtle.height);
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, turtle.width, turtle.height);

		// Grid overlay + intersection points
		ctx.strokeStyle = '#e5e7eb';
		ctx.lineWidth = 1;
		for (let x = 0; x <= turtle.width; x += cellSize) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, turtle.height);
			ctx.stroke();
		}
		for (let y = 0; y <= turtle.height; y += cellSize) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(turtle.width, y);
			ctx.stroke();
		}

		// Intersection dots to show possible start points
		ctx.fillStyle = '#d1d5db';
		for (let x = 0; x <= turtle.width; x += cellSize) {
			for (let y = 0; y <= turtle.height; y += cellSize) {
				ctx.beginPath();
				ctx.arc(x, y, 1.5, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		ctx.lineWidth = 2;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		// Student-drawn turtle path
		for (const segment of turtle.path) {
			ctx.strokeStyle = segment.color || '#000';
			ctx.beginPath();
			ctx.moveTo(segment.from.x, segment.from.y);
			ctx.lineTo(segment.to.x, segment.to.y);
			ctx.stroke();
		}

		// Teacher-drawn target path (path overlay)
		if (pathOverlay.length > 1) {
			ctx.strokeStyle = '#ff0000';
			ctx.lineWidth = 2;
			ctx.setLineDash([5, 5]);
			ctx.beginPath();
			ctx.moveTo(pathOverlay[0].x, pathOverlay[0].y);
			for (let i = 1; i < pathOverlay.length; i++) {
				ctx.lineTo(pathOverlay[i].x, pathOverlay[i].y);
			}
			ctx.stroke();
			ctx.setLineDash([]);
		}

		// Live preview segment while drawing path
		if (drawMode === 'path' && dragPoint && pathOverlay.length > 0) {
			const last = pathOverlay[pathOverlay.length - 1];
			ctx.strokeStyle = '#f97316';
			ctx.setLineDash([3, 3]);
			ctx.beginPath();
			ctx.moveTo(last.x, last.y);
			ctx.lineTo(dragPoint.x, dragPoint.y);
			ctx.stroke();
			ctx.setLineDash([]);
		}

		// Walls as gray squares
		ctx.fillStyle = '#9ca3af';
		for (const wall of walls) {
			const size = 20;
			ctx.fillRect(wall.x - size / 2, wall.y - size / 2, size, size);
		}

		// Apple as target
		if (apple) {
			const radius = 10;
			ctx.fillStyle = '#ef4444';
			ctx.beginPath();
			ctx.arc(apple.x, apple.y, radius, 0, Math.PI * 2);
			ctx.fill();
			// Little leaf
			ctx.fillStyle = '#22c55e';
			ctx.beginPath();
			ctx.ellipse(apple.x + 5, apple.y - radius, 4, 7, -0.5, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	watch(
		[() => turtle.state, () => turtle.path, () => pathOverlay, () => walls, () => apple, () => dragPoint],
		() => {
			drawTurtle();
		}
	);

	function handleClick(event: MouseEvent) {
		if (!editable) return;
		if (!drawMode) return;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const rawX = event.clientX - rect.left;
		const rawY = event.clientY - rect.top;
		// Snap to nearest grid cell center
		const col = Math.round(rawX / cellSize);
		const row = Math.round(rawY / cellSize);
		const x = col * cellSize;
		const y = row * cellSize;

		if (drawMode === 'path') {
			const next = [...pathOverlay, { x, y }];
			pathOverlay = next;
			onPathChange?.(next);
			dragPoint = null;
		} else if (drawMode === 'apple') {
			const next = { x, y };
			apple = next;
			onAppleChange?.(next);
		} else if (drawMode === 'wall') {
			const next = [...walls, { x, y }];
			walls = next;
			onWallsChange?.(next);
		}
	}

	function handleMove(event: MouseEvent) {
		if (!editable || drawMode !== 'path' || !canvas || pathOverlay.length === 0) {
			dragPoint = null;
			return;
		}
		const rect = canvas.getBoundingClientRect();
		const rawX = event.clientX - rect.left;
		const rawY = event.clientY - rect.top;
		const col = Math.round(rawX / cellSize);
		const row = Math.round(rawY / cellSize);
		dragPoint = { x: col * cellSize, y: row * cellSize };
	}

	$inspect(turtle.width, turtle.height, turtle.state);
</script>

<div class="relative">
	<canvas
		bind:this={canvas}
		width={turtle.width}
		height={turtle.height}
		class="block rounded border border-gray-300"
		onclick={handleClick}
		onmousemove={handleMove}
		onmouseleave={() => (dragPoint = null)}
	></canvas>
	<!-- SVG Turtle overlay -->
	<svg
		width={turtle.width}
		height={turtle.height}
		viewBox={`0 0 ${turtle.width} ${turtle.height}`}
		class="pointer-events-none absolute top-0 left-0"
		style="transform: none;"
	>
		<g transform="translate({turtleX}, {turtleY}) rotate({turtleAngle})">
			<!-- Simple turtle SVG -->
			<ellipse cx="0" cy="0" rx="15" ry="20" fill="#2d5016" stroke="#1a3009" stroke-width="2" />
			<!-- Head -->
			<circle cx="0" cy="-22" r="6" fill="#3d6b1f" stroke="#1a3009" stroke-width="1" />
			<!-- Eyes -->
			<circle cx="-2" cy="-24" r="1.5" fill="#fff" />
			<circle cx="2" cy="-24" r="1.5" fill="#fff" />
			<!-- Pupils -->
			<circle cx="-2" cy="-24" r="0.8" fill="#000" />
			<circle cx="2" cy="-24" r="0.8" fill="#000" />
			<!-- Legs -->
			<circle cx="-10" cy="-8" r="4" fill="#3d6b1f" />
			<circle cx="10" cy="-8" r="4" fill="#3d6b1f" />
			<circle cx="-10" cy="8" r="4" fill="#3d6b1f" />
			<circle cx="10" cy="8" r="4" fill="#3d6b1f" />
			<!-- Tail -->
			<path d="M 0 20 Q 5 30 3 38" stroke="#3d6b1f" stroke-width="2" fill="none" />
		</g>
	</svg>
</div>

<style>
	canvas {
		display: block;
		background: white;
	}

	div {
		position: relative;
		display: inline-block;
	}
</style>
