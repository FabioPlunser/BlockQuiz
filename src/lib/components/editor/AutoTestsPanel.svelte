<script lang="ts">
	import type { TestCase } from '$lib/types/exercise';
	import type { TargetPoint, Point } from '$lib/canvas/types';
	import { Target, Route, FlaskConical, Settings } from '@lucide/svelte';

	type Props = {
		targets: TargetPoint[];
		pathOverlay: Point[];
		testCases: TestCase[];
		appleTolerance: number;
		wallTolerance: number;
		onAppleToleranceChange?: (value: number) => void;
		onWallToleranceChange?: (value: number) => void;
	};

	let {
		targets,
		pathOverlay,
		testCases,
		appleTolerance,
		wallTolerance,
		onAppleToleranceChange,
		onWallToleranceChange
	}: Props = $props();

	// Derived values
	let targetTests = $derived(testCases.filter(t => t.type === 'target'));
	let pathTest = $derived(testCases.find(t => t.type === 'path'));
	let hasPath = $derived(pathOverlay.length > 1);
	let totalAutoTests = $derived(targetTests.length + (pathTest ? 1 : 0));
</script>

<div class="flex h-full flex-col gap-4 rounded-lg bg-base-200 p-4">
	<!-- Header -->
	<div class="flex items-center gap-2">
		<FlaskConical class="h-5 w-5 text-success" />
		<h3 class="font-bold">Auto-Generated Tests</h3>
		{#if totalAutoTests > 0}
			<span class="badge badge-success badge-sm">{totalAutoTests}</span>
		{/if}
	</div>

	<!-- Empty State -->
	{#if totalAutoTests === 0}
		<div class="flex flex-1 flex-col items-center justify-center text-center text-base-content/60">
			<FlaskConical class="mb-2 h-8 w-8 opacity-50" />
			<p class="text-sm">No tests yet</p>
			<p class="mt-1 text-xs">Place targets or draw a path on the canvas</p>
		</div>
	{:else}
		<!-- Tests List -->
		<div class="flex-1 space-y-3 overflow-y-auto">
			<!-- Target Tests -->
			{#if targetTests.length > 0}
				<div class="rounded-lg bg-base-300 p-3">
					<div class="mb-2 flex items-center gap-2">
						<Target class="h-4 w-4 text-error" />
						<span class="text-sm font-medium">Targets</span>
						<span class="badge badge-xs">{targetTests.length}</span>
					</div>
					<div class="space-y-1.5">
						{#each targetTests as test, i (test.id)}
							<div class="flex items-center gap-2 text-xs">
								<span class="badge badge-error badge-xs">{i + 1}</span>
								<span class="font-mono text-base-content/70">
									({test.expected.target?.x}, {test.expected.target?.y})
								</span>
								<span class="text-base-content/50">
									±{test.expected.target?.tolerance ?? appleTolerance}px
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Path Test -->
			{#if pathTest}
				<div class="rounded-lg bg-base-300 p-3">
					<div class="mb-2 flex items-center gap-2">
						<Route class="h-4 w-4 text-primary" />
						<span class="text-sm font-medium">Path</span>
					</div>
					<div class="text-xs text-base-content/70">
						<p>{pathOverlay.length} waypoints to follow</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Tolerance Settings -->
		<div class="rounded-lg border border-base-300 p-3">
			<div class="mb-2 flex items-center gap-2">
				<Settings class="h-4 w-4" />
				<span class="text-sm font-medium">Tolerance</span>
			</div>
			<div class="space-y-2">
				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-xs">Target tolerance (px)</span>
						<span class="label-text-alt text-xs">{appleTolerance}</span>
					</label>
					<input
						type="range"
						min="5"
						max="50"
						value={appleTolerance}
						class="range range-xs range-primary"
						oninput={(e) => onAppleToleranceChange?.(parseInt(e.currentTarget.value))}
					/>
				</div>
				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-xs">Wall tolerance (px)</span>
						<span class="label-text-alt text-xs">{wallTolerance}</span>
					</label>
					<input
						type="range"
						min="0"
						max="20"
						value={wallTolerance}
						class="range range-xs"
						oninput={(e) => onWallToleranceChange?.(parseInt(e.currentTarget.value))}
					/>
				</div>
			</div>
		</div>
	{/if}
</div>

