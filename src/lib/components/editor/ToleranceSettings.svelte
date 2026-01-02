<script lang="ts">
	import type { ExerciseMode } from '$lib/types/exercise';

	let {
		appleTolerance = $bindable(0.5),
		wallTolerance = $bindable(0),
		exerciseMode = 'default'
	}: {
		appleTolerance: number;
		wallTolerance: number;
		exerciseMode: ExerciseMode;
	} = $props();

	// Only show tolerances for relevant modes
	let showAppleTolerance = $derived(exerciseMode === 'apple' || exerciseMode === 'default');
	let showWallTolerance = $derived(exerciseMode === 'apple');
</script>

<div class="tolerance-settings">
	<div class="mb-3">
		<span class="font-medium">Grading Tolerances</span>
		<p class="text-xs text-base-content/60">
			Configure how lenient the grading should be (in grid cells)
		</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		{#if showAppleTolerance}
			<div class="form-control">
				<label class="label">
					<span class="label-text">🍎 Target Tolerance</span>
					<span class="label-text-alt">{appleTolerance.toFixed(2)} cells</span>
				</label>
				<input
					type="range"
					class="range range-primary range-sm"
					min="0"
					max="2"
					step="0.25"
					bind:value={appleTolerance}
				/>
				<div class="flex w-full justify-between px-2 text-xs text-base-content/60">
					<span>Strict</span>
					<span>Lenient</span>
				</div>
				<p class="mt-1 text-xs text-base-content/60">
					{#if appleTolerance === 0}
						Student must reach exact cell
					{:else if appleTolerance <= 0.5}
						Within half a grid cell
					{:else if appleTolerance <= 1}
						Within one grid cell
					{:else}
						Very lenient - within {appleTolerance.toFixed(1)} cells
					{/if}
				</p>
			</div>
		{/if}

		{#if showWallTolerance}
			<div class="form-control">
				<label class="label">
					<span class="label-text">🧱 Wall Tolerance</span>
					<span class="label-text-alt">{wallTolerance.toFixed(2)} cells</span>
				</label>
				<input
					type="range"
					class="range range-secondary range-sm"
					min="0"
					max="1"
					step="0.25"
					bind:value={wallTolerance}
				/>
				<div class="flex w-full justify-between px-2 text-xs text-base-content/60">
					<span>Exact</span>
					<span>Forgiving</span>
				</div>
				<p class="mt-1 text-xs text-base-content/60">
					{#if wallTolerance === 0}
						Fail immediately on wall cell
					{:else if wallTolerance <= 0.5}
						Small buffer zone around walls
					{:else}
						Larger safe zone around walls
					{/if}
				</p>
			</div>
		{/if}
	</div>

	{#if !showAppleTolerance && !showWallTolerance}
		<div class="rounded-lg bg-base-200 p-4 text-center text-sm text-base-content/60">
			Tolerance settings are available for "Reach Target" mode
		</div>
	{/if}

	<!-- Visual Preview -->
	{#if showAppleTolerance || showWallTolerance}
		<div class="mt-4 rounded-lg bg-base-200 p-4">
			<div class="mb-2 text-sm font-medium">Visual Preview</div>
			<div class="flex items-center justify-center gap-8">
				{#if showAppleTolerance}
					<div class="flex flex-col items-center">
						<div class="relative h-16 w-16">
							<!-- Target zone -->
							<div
								class="absolute rounded-full bg-green-200/50 border-2 border-dashed border-green-400"
								style="
									width: {32 + appleTolerance * 32}px;
									height: {32 + appleTolerance * 32}px;
									top: 50%;
									left: 50%;
									transform: translate(-50%, -50%);
								"
							></div>
							<!-- Apple -->
							<div
								class="absolute h-6 w-6 rounded-full bg-red-500"
								style="top: 50%; left: 50%; transform: translate(-50%, -50%);"
							></div>
						</div>
						<span class="mt-1 text-xs">Target zone</span>
					</div>
				{/if}

				{#if showWallTolerance}
					<div class="flex flex-col items-center">
						<div class="relative h-16 w-16">
							<!-- Wall danger zone -->
							{#if wallTolerance > 0}
								<div
									class="absolute bg-red-200/50 border-2 border-dashed border-red-400"
									style="
										width: {24 + wallTolerance * 24}px;
										height: {24 + wallTolerance * 24}px;
										top: 50%;
										left: 50%;
										transform: translate(-50%, -50%);
									"
								></div>
							{/if}
							<!-- Wall -->
							<div
								class="absolute h-6 w-6 bg-gray-600"
								style="top: 50%; left: 50%; transform: translate(-50%, -50%);"
							></div>
						</div>
						<span class="mt-1 text-xs">Wall danger zone</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

