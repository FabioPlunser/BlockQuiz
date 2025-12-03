<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	let { width = 400, height = 400, pathOverlay = null, targetPoint = null } = $props();

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null;
	let commandLog: string[] = $state([]);
	let turtleX = $state(width / 2);
	let turtleY = $state(height / 2);
	let turtleAngle = $state(0);

	onMount(() => {
		if (!browser) return;
		ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, width, height);
		drawOverlays();
		drawTurtle();
	});

	function drawOverlays() {
		if (!ctx) return;
		// Draw path
		if (pathOverlay?.points?.length > 0) {
			ctx.strokeStyle = '#000';
			ctx.lineWidth = 2;
			ctx.setLineDash([5, 5]);
			ctx.moveTo(pathOverlay.points[0].x, pathOverlay.points[0].y);
			for (let i = 1; i < pathOverlay.points.length; i++) {
				ctx.lineTo(pathOverlay.points[i].x, pathOverlay.points[i].y);
			}
			ctx.stroke();
			ctx.setLineDash([]);
		}

		// Draw target point
		if (targetPoint) {
			ctx.fillStyle = 'rgba(0,255,0,0.3)';
			ctx.beginPath();
			ctx.arc(targetPoint.x, targetPoint.y, targetPoint.tolerance || 10, 0, 2 * Math.PI);
			ctx.fill();
			ctx.fillStyle = '#0f0';
			ctx.lineWidth = 2;
			ctx.stroke();
		}
	}

	function drawTurtle() {
		if (!browser || !ctx) return;

		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, width, height);

		// Draw path overlay
		drawOverlays();

		// Draw strokes from command log
		let x = width / 2;
		let y = height / 2;
		let angle = 0;
		let pen = true;
		let color = '#000';

		ctx.lineWidth = 2;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		for (const cmd of commandLog) {
			const [op, ...args] = cmd.split(':');

			if (op === 'move') {
				const dist = parseInt(args[0]);
				const rad = (angle * Math.PI) / 180;
				const nx = x + dist * Math.sin(rad);
				const ny = y - dist * Math.cos(rad);

				if (pen) {
					ctx.strokeStyle = color;
					ctx.beginPath();
					ctx.moveTo(x, y);
					ctx.lineTo(nx, ny);
					ctx.stroke();
				}
				x = nx;
				y = ny;
			} else if (op === 'turn') {
				angle = (angle + parseInt(args[0])) % 360;
			} else if (op === 'penDown') {
				pen = true;
			} else if (op === 'penUp') {
				pen = false;
			} else if (op === 'color') {
				color = args[0];
			}
		}

		turtleX = x;
		turtleY = y;
		turtleAngle = angle;
	}

	export const api = {
		move(dist: number) {
			commandLog.push(`move:${dist}`);
			drawTurtle();
		},
		turn(deg: number) {
			commandLog.push(`turn:${deg}`);
			drawTurtle();
		},
		penUp() {
			commandLog.push('penUp');
		},
		penDown() {
			commandLog.push('penDown');
		},
		color(hex: string) {
			commandLog.push(`color:${hex}`);
			drawTurtle();
		},
		reset() {
			commandLog = [];
			drawTurtle();
		},
		getLog() {
			return commandLog;
		}
	};
</script>

<div class="relative">
	<canvas bind:this={canvas} {width} {height} class="block rounded border border-gray-300"></canvas>
	<!-- SVG Turtle overlay -->
	<svg {width} {height} class="pointer-events-none absolute top-0 left-0" style="transform: none;">
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
