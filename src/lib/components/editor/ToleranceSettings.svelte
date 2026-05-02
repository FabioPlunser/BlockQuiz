<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';
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
		<span class="font-medium">{i18n.cms_tolerance_title}</span>
		<p class="text-xs text-base-content/60">
			{i18n.cms_tolerance_hint}
		</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		{#if showAppleTolerance}
			<div class="form-control">
				<label class="label" for="apple-tolerance">
					<span class="label-text">🍎 {i18n.cms_tolerance_target}</span>
					<span class="label-text-alt">{appleTolerance.toFixed(2)} {i18n.cms_tolerance_cells}</span>
				</label>
				<input
					id="apple-tolerance"
					type="range"
					class="range range-primary range-sm"
					min="0"
					max="2"
					step="0.25"
					bind:value={appleTolerance}
				/>
				<div class="flex w-full justify-between px-2 text-xs text-base-content/60">
					<span>{i18n.cms_tolerance_strict}</span>
					<span>{i18n.cms_tolerance_lenient}</span>
				</div>
				<p class="mt-1 text-xs text-base-content/60">
					{#if appleTolerance === 0}
						{i18n.cms_tolerance_target_exact}
					{:else if appleTolerance <= 0.5}
						{i18n.cms_tolerance_target_half_cell}
					{:else if appleTolerance <= 1}
						{i18n.cms_tolerance_target_one_cell}
					{:else}
						{i18n.cms_tolerance_target_very_lenient_prefix}
						{appleTolerance.toFixed(1)}
						{i18n.cms_tolerance_cells}
					{/if}
				</p>
			</div>
		{/if}

		{#if showWallTolerance}
			<div class="form-control">
				<label class="label" for="wall-tolerance">
					<span class="label-text">🧱 {i18n.cms_tolerance_wall}</span>
					<span class="label-text-alt">{wallTolerance.toFixed(2)} {i18n.cms_tolerance_cells}</span>
				</label>
				<input
					id="wall-tolerance"
					type="range"
					class="range range-secondary range-sm"
					min="0"
					max="1"
					step="0.25"
					bind:value={wallTolerance}
				/>
				<div class="flex w-full justify-between px-2 text-xs text-base-content/60">
					<span>{i18n.cms_tolerance_exact}</span>
					<span>{i18n.cms_tolerance_forgiving}</span>
				</div>
				<p class="mt-1 text-xs text-base-content/60">
					{#if wallTolerance === 0}
						{i18n.cms_tolerance_wall_fail_immediately}
					{:else if wallTolerance <= 0.5}
						{i18n.cms_tolerance_wall_small_buffer}
					{:else}
						{i18n.cms_tolerance_wall_larger_safe_zone}
					{/if}
				</p>
			</div>
		{/if}
	</div>

	{#if !showAppleTolerance && !showWallTolerance}
		<div class="rounded-lg bg-base-200 p-4 text-center text-sm text-base-content/60">
			{i18n.cms_tolerance_unavailable}
		</div>
	{/if}

	<!-- Visual Preview -->
	{#if showAppleTolerance || showWallTolerance}
		<div class="mt-4 rounded-lg bg-base-200 p-4">
			<div class="mb-2 text-sm font-medium">{i18n.cms_tolerance_visual_preview}</div>
			<div class="flex items-center justify-center gap-8">
				{#if showAppleTolerance}
					<div class="flex flex-col items-center">
						<div class="relative h-16 w-16">
							<!-- Target zone -->
							<div
								class="absolute rounded-full border-2 border-dashed border-green-400 bg-green-200/50"
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
						<span class="mt-1 text-xs">{i18n.cms_tolerance_target_zone}</span>
					</div>
				{/if}

				{#if showWallTolerance}
					<div class="flex flex-col items-center">
						<div class="relative h-16 w-16">
							<!-- Wall danger zone -->
							{#if wallTolerance > 0}
								<div
									class="absolute border-2 border-dashed border-red-400 bg-red-200/50"
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
						<span class="mt-1 text-xs">{i18n.cms_tolerance_wall_danger_zone}</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
