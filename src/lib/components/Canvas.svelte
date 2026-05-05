<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type {
		ICanvasEngine,
		IPositionEngine,
		Point,
		DrawMode,
		TargetPoint,
		Obstacle
	} from '$lib/canvas/types';

	/** Built-in actor types for common use cases */
	export type ActorType = 'turtle' | 'robot' | 'arrow' | 'none';

	export interface CanvasProps {
		/** The canvas engine (Turtle, Robot, Dino, etc.) */
		engine: ICanvasEngine | IPositionEngine;

		/** Built-in actor type - use this for quick setup */
		actorType?: ActorType;

		/** Custom actor renderer snippet - overrides actorType if provided */
		actor?: Snippet<[{ x: number; y: number; angle: number }]>;

		// === Overlay configuration ===
		showGrid?: boolean;
		gridSize?: number;
		pathOverlay?: Point[];
		targets?: TargetPoint[];
		walls?: Point[];
		obstacles?: Obstacle[];

		// === Editor mode ===
		editable?: boolean;
		drawMode?: DrawMode;

		// === Callbacks ===
		onPathChange?: (points: Point[]) => void;
		onTargetChange?: (targets: TargetPoint[]) => void;
		onWallsChange?: (walls: Point[]) => void;
	}
</script>

<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { watch } from 'runed';
	import { i18n } from '$lib/i18n/index.svelte';

	let {
		engine,
		actorType = 'turtle',
		actor,
		showGrid = false,
		gridSize = 50,
		pathOverlay = [],
		targets = [],
		walls = [],
		obstacles = [],
		editable = false,
		drawMode = null,
		onPathChange,
		onTargetChange,
		onWallsChange
	}: CanvasProps = $props();

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null;
	let dragPoint: Point | null = null;

	// Type guard to check if engine is position-based
	function isPositionEngine(e: ICanvasEngine): e is IPositionEngine {
		return 'state' in e && 'x' in (e as IPositionEngine).state;
	}

	// Safe getters for position state with NaN guards
	let actorX = $derived.by(() => {
		if (!isPositionEngine(engine)) return engine.width / 2;
		return Number.isFinite(engine.state.x) ? engine.state.x : engine.width / 2;
	});
	let actorY = $derived.by(() => {
		if (!isPositionEngine(engine)) return engine.height / 2;
		return Number.isFinite(engine.state.y) ? engine.state.y : engine.height / 2;
	});
	let actorAngle = $derived.by(() => {
		if (!isPositionEngine(engine)) return 0;
		return Number.isFinite(engine.state.angle) ? engine.state.angle : 0;
	});

	// Get path segments from engine if available
	let pathSegments = $derived(engine.path ?? []);

	onMount(() => {
		if (!browser) return;
		ctx = canvas.getContext('2d');
		if (!ctx) return;
		drawCanvas();
	});

	watch(
		() => showGrid,
		() => drawCanvas()
	);

	function drawCanvas() {
		if (!browser || !ctx) return;

		// Clear canvas
		ctx.clearRect(0, 0, engine.width, engine.height);
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, engine.width, engine.height);

		// Grid overlay
		if (showGrid) {
			ctx.strokeStyle = '#e5e7eb';
			ctx.lineWidth = 1;
			for (let x = 0; x <= engine.width; x += gridSize) {
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x, engine.height);
				ctx.stroke();
			}
			for (let y = 0; y <= engine.height; y += gridSize) {
				ctx.beginPath();
				ctx.moveTo(0, y);
				ctx.lineTo(engine.width, y);
				ctx.stroke();
			}

			// Intersection dots
			ctx.fillStyle = '#d1d5db';
			for (let x = 0; x <= engine.width; x += gridSize) {
				for (let y = 0; y <= engine.height; y += gridSize) {
					ctx.beginPath();
					ctx.arc(x, y, 1.5, 0, Math.PI * 2);
					ctx.fill();
				}
			}
		}

		ctx.lineWidth = 2;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		// Engine path segments (e.g., turtle trail)
		for (const segment of pathSegments) {
			ctx.strokeStyle = segment.color || '#000';
			ctx.lineWidth = segment.width || 2;
			ctx.beginPath();
			ctx.moveTo(segment.from.x, segment.from.y);
			ctx.lineTo(segment.to.x, segment.to.y);
			ctx.stroke();
		}

		// Teacher-drawn path overlay
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

		// Live preview while drawing path
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

		// Walls
		ctx.fillStyle = '#9ca3af';
		for (const wall of walls) {
			const size = 20;
			ctx.fillRect(wall.x - size / 2, wall.y - size / 2, size, size);
		}

		// Obstacles (for side-scrollers)
		for (const obs of obstacles) {
			ctx.fillStyle = obs.type === 'cactus' ? '#22c55e' : '#6b7280';
			ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
		}

		// Targets (apples, flags, etc.)
		for (const target of targets) {
			drawTarget(ctx, target);
		}
	}

	function drawTarget(ctx: CanvasRenderingContext2D, target: TargetPoint) {
		const icon = target.icon ?? 'apple';
		const radius = 10;

		if (icon === 'apple') {
			ctx.fillStyle = '#ef4444';
			ctx.beginPath();
			ctx.arc(target.x, target.y, radius, 0, Math.PI * 2);
			ctx.fill();
			// Leaf
			ctx.fillStyle = '#22c55e';
			ctx.beginPath();
			ctx.ellipse(target.x + 5, target.y - radius, 4, 7, -0.5, 0, Math.PI * 2);
			ctx.fill();
		} else if (icon === 'flag') {
			ctx.fillStyle = '#3b82f6';
			ctx.fillRect(target.x - 2, target.y - 20, 4, 25);
			ctx.beginPath();
			ctx.moveTo(target.x + 2, target.y - 20);
			ctx.lineTo(target.x + 15, target.y - 13);
			ctx.lineTo(target.x + 2, target.y - 6);
			ctx.fill();
		} else if (icon === 'star') {
			ctx.fillStyle = '#fbbf24';
			drawStar(ctx, target.x, target.y, 5, radius, radius / 2);
		} else {
			// Default circle
			ctx.fillStyle = '#8b5cf6';
			ctx.beginPath();
			ctx.arc(target.x, target.y, radius, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	function drawStar(
		ctx: CanvasRenderingContext2D,
		cx: number,
		cy: number,
		spikes: number,
		outerRadius: number,
		innerRadius: number
	) {
		let rot = (Math.PI / 2) * 3;
		const step = Math.PI / spikes;

		ctx.beginPath();
		ctx.moveTo(cx, cy - outerRadius);

		for (let i = 0; i < spikes; i++) {
			ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
			rot += step;
			ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
			rot += step;
		}

		ctx.lineTo(cx, cy - outerRadius);
		ctx.closePath();
		ctx.fill();
	}

	// Watch for state changes
	watch(
		[
			() => engine.width,
			() => engine.height,
			() => gridSize,
			() => (isPositionEngine(engine) ? engine.state : null),
			() => pathSegments,
			() => pathOverlay,
			() => walls,
			() => targets,
			() => obstacles,
			() => dragPoint
		],
		() => drawCanvas()
	);

	function snapToGrid(x: number, y: number): Point {
		const col = Math.round(x / gridSize);
		const row = Math.round(y / gridSize);
		return { x: col * gridSize, y: row * gridSize };
	}

	function getCanvasPoint(event: PointerEvent): Point {
		const rect = canvas.getBoundingClientRect();
		const scaleX = engine.width / Math.max(rect.width, 1);
		const scaleY = engine.height / Math.max(rect.height, 1);
		return {
			x: (event.clientX - rect.left) * scaleX,
			y: (event.clientY - rect.top) * scaleY
		};
	}

	function handlePointerDown(event: PointerEvent) {
		if (!editable || !drawMode || !canvas) return;
		event.preventDefault();
		canvas.setPointerCapture?.(event.pointerId);

		const { x: rawX, y: rawY } = getCanvasPoint(event);
		const { x, y } = snapToGrid(rawX, rawY);

		if (drawMode === 'path') {
			const next = [...pathOverlay, { x, y }];
			pathOverlay = next;
			onPathChange?.(next);
			dragPoint = null;
		} else if (drawMode === 'target') {
			const next = [...targets, { x, y }];
			targets = next;
			onTargetChange?.(next);
		} else if (drawMode === 'wall') {
			const next = [...walls, { x, y }];
			walls = next;
			onWallsChange?.(next);
		}
	}

	function handlePointerMove(event: PointerEvent) {
		if (!editable || drawMode !== 'path' || !canvas || pathOverlay.length === 0) {
			dragPoint = null;
			return;
		}
		const { x: rawX, y: rawY } = getCanvasPoint(event);
		dragPoint = snapToGrid(rawX, rawY);
	}
</script>

<div class="canvas-container">
	<canvas
		bind:this={canvas}
		width={engine.width}
		height={engine.height}
		class="canvas"
		aria-label={i18n.canvas_aria_label}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerleave={() => (dragPoint = null)}
	></canvas>

	<!-- SVG Actor overlay -->
	<svg
		width={engine.width}
		height={engine.height}
		viewBox={`0 0 ${engine.width} ${engine.height}`}
		class="actor-overlay"
	>
		{#if actor}
			<!-- Custom actor snippet provided -->
			{@render actor({ x: actorX, y: actorY, angle: actorAngle })}
		{:else if actorType === 'turtle'}
			<!-- Built-in Turtle actor -->
			<g transform="translate({actorX}, {actorY}) rotate({actorAngle})">
				<ellipse cx="0" cy="0" rx="15" ry="20" fill="#2d5016" stroke="#1a3009" stroke-width="2" />
				<circle cx="0" cy="-22" r="6" fill="#3d6b1f" stroke="#1a3009" stroke-width="1" />
				<circle cx="-2" cy="-24" r="1.5" fill="#fff" />
				<circle cx="2" cy="-24" r="1.5" fill="#fff" />
				<circle cx="-2" cy="-24" r="0.8" fill="#000" />
				<circle cx="2" cy="-24" r="0.8" fill="#000" />
				<circle cx="-10" cy="-8" r="4" fill="#3d6b1f" />
				<circle cx="10" cy="-8" r="4" fill="#3d6b1f" />
				<circle cx="-10" cy="8" r="4" fill="#3d6b1f" />
				<circle cx="10" cy="8" r="4" fill="#3d6b1f" />
				<path d="M 0 20 Q 5 30 3 38" stroke="#3d6b1f" stroke-width="2" fill="none" />
			</g>
		{:else if actorType === 'robot'}
			<!-- Built-in Robot actor -->
			<g transform="translate({actorX}, {actorY}) rotate({actorAngle})">
				<rect
					x="-12"
					y="-18"
					width="24"
					height="30"
					rx="4"
					fill="#3b82f6"
					stroke="#1e40af"
					stroke-width="2"
				/>
				<rect x="-8" y="-14" width="16" height="10" rx="2" fill="#1e293b" />
				<circle cx="-3" cy="-9" r="2" fill="#22c55e" />
				<circle cx="3" cy="-9" r="2" fill="#22c55e" />
				<rect x="-16" y="-8" width="4" height="12" rx="1" fill="#1e293b" />
				<rect x="12" y="-8" width="4" height="12" rx="1" fill="#1e293b" />
				<line x1="0" y1="-18" x2="0" y2="-26" stroke="#1e293b" stroke-width="2" />
				<circle cx="0" cy="-28" r="3" fill="#ef4444" />
			</g>
		{:else if actorType === 'arrow'}
			<!-- Simple arrow actor (minimal, good for debugging) -->
			<g transform="translate({actorX}, {actorY}) rotate({actorAngle})">
				<polygon points="0,-15 8,10 0,5 -8,10" fill="#6366f1" stroke="#4338ca" stroke-width="2" />
			</g>
		{:else if actorType === 'none'}
			<!-- No actor rendered -->
		{/if}
	</svg>
</div>

<style>
	.canvas-container {
		position: relative;
		display: inline-block;
		max-width: 100%;
		overflow: auto;
	}

	.canvas {
		display: block;
		max-width: 100%;
		height: auto;
		background: white;
		border-radius: 0.375rem;
		border: 1px solid #d1d5db;
		touch-action: none;
	}

	.actor-overlay {
		position: absolute;
		top: 0;
		left: 0;
		max-width: 100%;
		height: auto;
		pointer-events: none;
		transform: none;
	}
</style>
