<script lang="ts">
	import { Canvas2D } from '$lib/canvas/Canvas2D.svelte';

	const canvas = new Canvas2D(400, 400);
	canvas.api.move(200);
	canvas.api.turn(200);
</script>

<div class="flex h-screen w-full items-center justify-center gap-4">
	<div class="card w-48 bg-base-200 shadow-2xl">
		<div class="card-body">
			<div class="flex flex-col gap-4">
				<h1 class="text-bold text-black">X: {canvas.state.x}</h1>
				<h1 class="text-bold text-black">Y: {canvas.state.y}</h1>
				<h1 class="text-bold text-black">Angle: {canvas.state.angle}</h1>
			</div>
		</div>
	</div>
	<div class="card w-48 bg-base-200 shadow-2xl">
		<div class="card-body">
			<div class="flex flex-col gap-4">
				<input type="range" min="0" max="100" bind:value={canvas.state.x} class="range range-xs" />
				<input type="range" min="0" max="100" bind:value={canvas.state.y} class="range range-xs" />
				<input type="range" min="0" max="100" bind:value={canvas.state.angle} />
			</div>
		</div>
	</div>
</div>
