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

		export type CanvasSelection =
			| { kind: 'target' | 'wall' | 'path'; index: number }
			| { kind: 'start' | 'finish' }
			| null;

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
		start?: Point | null;
		finish?: Point | null;
		hideActor?: boolean;

		// === Editor mode ===
		editable?: boolean;
		drawMode?: DrawMode;
		/** Bindable: the currently selected canvas item (in `select` mode). */
		selected?: CanvasSelection;

		// === Callbacks ===
		onPathChange?: (points: Point[]) => void;
		onTargetChange?: (targets: TargetPoint[]) => void;
		onWallsChange?: (walls: Point[]) => void;
		onStartChange?: (point: Point | null) => void;
		onFinishChange?: (point: Point | null) => void;
	}
</script>

<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { watch } from 'runed';
	import { i18n } from '$lib/i18n/index.svelte';
	import { dedupePointsByCell } from '$lib/canvas/grid';
	import { checkReachability } from '$lib/canvas/pathfinding';

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
		start = null,
		finish = null,
		hideActor = false,
		editable = false,
		drawMode = null,
		selected = $bindable(null),
		onPathChange,
		onTargetChange,
		onWallsChange,
		onStartChange,
		onFinishChange
	}: CanvasProps = $props();

	const START_FINISH_RADIUS = 16;

	let reachability = $derived(
		start || finish
			? checkReachability({
					width: engine.width,
					height: engine.height,
					gridSize,
					walls,
					start,
					finish
				})
			: { ok: true as const }
	);

	let collectedTargets = $derived(
		'collectedTargets' in engine ? (engine as { collectedTargets: number[] }).collectedTargets : []
	);

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null;
	let dragPoint: Point | null = null;
	let hovered: CanvasSelection = $state(null);

	export function deleteSelected() {
		if (!selected) return;
		const current = selected;
		if (current.kind === 'target') {
			const next = targets.filter((_, i) => i !== current.index);
			targets = next;
			onTargetChange?.(next);
		} else if (current.kind === 'wall') {
			const next = walls.filter((_, i) => i !== current.index);
			walls = next;
			onWallsChange?.(next);
		} else if (current.kind === 'path') {
			const next = pathOverlay.filter((_, i) => i !== current.index);
			pathOverlay = next;
			onPathChange?.(next);
		} else if (current.kind === 'start') {
			start = null;
			onStartChange?.(null);
		} else if (selected.kind === 'finish') {
			finish = null;
			onFinishChange?.(null);
		}
		selected = null;
	}

	export function clearSelection() {
		selected = null;
	}

	const SELECT_HIT_TARGET = 14;
	const SELECT_HIT_WALL = 14;
	const SELECT_HIT_PATH = 8;

	function hitTest(point: Point): typeof hovered {
		if (start) {
			const dx = start.x - point.x;
			const dy = start.y - point.y;
			if (dx * dx + dy * dy <= START_FINISH_RADIUS * START_FINISH_RADIUS) {
				return { kind: 'start' };
			}
		}
		if (finish) {
			const dx = finish.x - point.x;
			const dy = finish.y - point.y;
			if (dx * dx + dy * dy <= START_FINISH_RADIUS * START_FINISH_RADIUS) {
				return { kind: 'finish' };
			}
		}
		for (let i = targets.length - 1; i >= 0; i--) {
			const t = targets[i];
			const dx = t.x - point.x;
			const dy = t.y - point.y;
			const r = Math.max(t.tolerance ?? SELECT_HIT_TARGET, SELECT_HIT_TARGET);
			if (dx * dx + dy * dy <= r * r) return { kind: 'target', index: i };
		}
		for (let i = walls.length - 1; i >= 0; i--) {
			const w = walls[i];
			if (Math.abs(w.x - point.x) <= SELECT_HIT_WALL && Math.abs(w.y - point.y) <= SELECT_HIT_WALL) {
				return { kind: 'wall', index: i };
			}
		}
		for (let i = pathOverlay.length - 1; i >= 0; i--) {
			const p = pathOverlay[i];
			const dx = p.x - point.x;
			const dy = p.y - point.y;
			if (dx * dx + dy * dy <= SELECT_HIT_PATH * SELECT_HIT_PATH) {
				return { kind: 'path', index: i };
			}
		}
		return null;
	}

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

		// Targets (apples, flags, etc.) — collected ones are dimmed
		const collectedSet = new Set(collectedTargets);
		for (let i = 0; i < targets.length; i++) {
			const target = targets[i];
			if (collectedSet.has(i)) {
				ctx.save();
				ctx.globalAlpha = 0.18;
				drawTarget(ctx, target);
				ctx.restore();
			} else {
				drawTarget(ctx, target);
			}
		}

		// Start & finish markers
		if (start) drawStartMarker(ctx, start);
		if (finish) drawFinishMarker(ctx, finish, !reachability.ok);

		// Selection highlights (select mode only)
		if (drawMode === 'select') {
			drawSelectionRing(ctx, hovered, { color: '#f97316', width: 2, dashed: true });
			drawSelectionRing(ctx, selected, { color: '#ef4444', width: 3, dashed: false });
		}
	}

	function drawSelectionRing(
		ctx: CanvasRenderingContext2D,
		ring: CanvasSelection,
		style: { color: string; width: number; dashed: boolean }
	) {
		if (!ring) return;
		ctx.save();
		ctx.strokeStyle = style.color;
		ctx.lineWidth = style.width;
		ctx.setLineDash(style.dashed ? [4, 3] : []);
		if (ring.kind === 'target' && targets[ring.index]) {
			const t = targets[ring.index];
			ctx.beginPath();
			ctx.arc(t.x, t.y, (t.tolerance ?? 12) + 6, 0, Math.PI * 2);
			ctx.stroke();
		} else if (ring.kind === 'wall' && walls[ring.index]) {
			const w = walls[ring.index];
			ctx.strokeRect(w.x - 14, w.y - 14, 28, 28);
		} else if (ring.kind === 'path' && pathOverlay[ring.index]) {
			const p = pathOverlay[ring.index];
			ctx.beginPath();
			ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
			ctx.stroke();
		} else if (ring.kind === 'start' && start) {
			ctx.beginPath();
			ctx.arc(start.x, start.y, START_FINISH_RADIUS + 4, 0, Math.PI * 2);
			ctx.stroke();
		} else if (ring.kind === 'finish' && finish) {
			ctx.beginPath();
			ctx.arc(finish.x, finish.y, START_FINISH_RADIUS + 4, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.restore();
	}

	function drawStartMarker(ctx: CanvasRenderingContext2D, point: Point) {
		ctx.save();
		ctx.fillStyle = '#22c55e';
		ctx.strokeStyle = '#14532d';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(point.x, point.y, 14, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.moveTo(point.x - 4, point.y - 6);
		ctx.lineTo(point.x + 6, point.y);
		ctx.lineTo(point.x - 4, point.y + 6);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	function drawFinishMarker(ctx: CanvasRenderingContext2D, point: Point, dim: boolean) {
		ctx.save();
		if (dim) ctx.globalAlpha = 0.35;
		const size = 22;
		const half = size / 2;
		const cells = 4;
		const cell = size / cells;
		for (let row = 0; row < cells; row++) {
			for (let col = 0; col < cells; col++) {
				ctx.fillStyle = (row + col) % 2 === 0 ? '#111827' : '#ffffff';
				ctx.fillRect(point.x - half + col * cell, point.y - half + row * cell, cell, cell);
			}
		}
		ctx.strokeStyle = '#111827';
		ctx.lineWidth = 2;
		ctx.strokeRect(point.x - half, point.y - half, size, size);
		ctx.restore();
		if (dim) {
			ctx.save();
			ctx.fillStyle = '#f59e0b';
			ctx.font = 'bold 14px system-ui, sans-serif';
			ctx.textAlign = 'left';
			ctx.textBaseline = 'middle';
			ctx.fillText('⚠', point.x + 16, point.y - 14);
			ctx.restore();
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
			() => start,
			() => finish,
			() => collectedTargets,
			() => reachability,
			() => dragPoint,
			() => hovered,
			() => selected,
			() => drawMode
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

		if (drawMode === 'select') {
			selected = hitTest({ x: rawX, y: rawY });
			return;
		}

		const { x, y } = snapToGrid(rawX, rawY);

		if (drawMode === 'path') {
			const next = [...pathOverlay, { x, y }];
			pathOverlay = next;
			onPathChange?.(next);
			dragPoint = null;
		} else if (drawMode === 'target') {
			const next = dedupePointsByCell([...targets, { x, y }], gridSize);
			targets = next;
			onTargetChange?.(next);
		} else if (drawMode === 'wall') {
			const next = dedupePointsByCell([...walls, { x, y }], gridSize);
			walls = next;
			onWallsChange?.(next);
		} else if (drawMode === 'start') {
			start = { x, y };
			onStartChange?.(start);
		} else if (drawMode === 'finish') {
			finish = { x, y };
			onFinishChange?.(finish);
		}
	}

	function handlePointerMove(event: PointerEvent) {
		if (!editable || !canvas) {
			dragPoint = null;
			hovered = null;
			return;
		}

		const { x: rawX, y: rawY } = getCanvasPoint(event);

		if (drawMode === 'select') {
			hovered = hitTest({ x: rawX, y: rawY });
			dragPoint = null;
			return;
		}

		hovered = null;

		if (drawMode !== 'path' || pathOverlay.length === 0) {
			dragPoint = null;
			return;
		}
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
		onpointerleave={() => {
			dragPoint = null;
			hovered = null;
		}}
		style:cursor={drawMode === 'select' ? (hovered ? 'pointer' : 'crosshair') : null}
	></canvas>

	<!-- SVG Actor overlay -->
	{#if !hideActor}
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
	{/if}
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
