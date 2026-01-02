<script lang="ts">
	import type { ExerciseHint } from '$lib/types/exercise';
	import { createHint } from '$lib/types/exercise';
	import LocalizedInput from './LocalizedInput.svelte';

	let {
		hints = $bindable<ExerciseHint[]>([])
	}: {
		hints: ExerciseHint[];
	} = $props();

	function addHint() {
		hints = [...hints, createHint()];
	}

	function removeHint(id: string) {
		hints = hints.filter((h) => h.id !== id);
	}

	function moveHint(index: number, direction: 'up' | 'down') {
		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= hints.length) return;

		const newHints = [...hints];
		[newHints[index], newHints[newIndex]] = [newHints[newIndex], newHints[index]];
		hints = newHints;
	}

	function updateHint(index: number, updates: Partial<ExerciseHint>) {
		hints = hints.map((h, i) => (i === index ? { ...h, ...updates } : h));
	}
</script>

<div class="hint-editor">
	<div class="mb-3 flex items-center justify-between">
		<div>
			<span class="font-medium">Progressive Hints</span>
			<p class="text-xs text-base-content/60">
				Hints are revealed in order. Configure each hint to appear on click or after a time delay.
			</p>
		</div>
		<button type="button" class="btn btn-primary btn-sm" onclick={addHint}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			Add Hint
		</button>
	</div>

	{#if hints.length === 0}
		<div class="rounded-lg border-2 border-dashed border-base-300 p-6 text-center">
			<p class="text-base-content/60">No hints yet. Add hints to help students when stuck.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each hints as hint, index (hint.id)}
				<div class="card bg-base-200">
					<div class="card-body p-4">
						<!-- Header -->
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="badge badge-neutral">Hint {index + 1}</span>
								<span class="text-xs text-base-content/60">
									{hint.trigger === 'click'
										? 'Revealed on click'
										: `Auto-reveal after ${hint.delaySeconds || 0}s`}
								</span>
							</div>
							<div class="flex gap-1">
								<button
									type="button"
									class="btn btn-ghost btn-xs"
									onclick={() => moveHint(index, 'up')}
									disabled={index === 0}
								>
									↑
								</button>
								<button
									type="button"
									class="btn btn-ghost btn-xs"
									onclick={() => moveHint(index, 'down')}
									disabled={index === hints.length - 1}
								>
									↓
								</button>
								<button
									type="button"
									class="btn btn-ghost btn-xs text-error"
									onclick={() => removeHint(hint.id)}
								>
									✕
								</button>
							</div>
						</div>

						<!-- Hint Text -->
						<LocalizedInput bind:value={hint.text} label="" placeholder="Hint text..." type="textarea" />

						<!-- Trigger Configuration -->
						<div class="mt-3 flex flex-wrap items-center gap-4">
							<div class="form-control">
								<label class="label cursor-pointer gap-2">
									<input
										type="radio"
										name={`hint-trigger-${hint.id}`}
										class="radio radio-sm radio-primary"
										checked={hint.trigger === 'click'}
										onchange={() => updateHint(index, { trigger: 'click' })}
									/>
									<span class="label-text">Show on click</span>
								</label>
							</div>
							<div class="form-control">
								<label class="label cursor-pointer gap-2">
									<input
										type="radio"
										name={`hint-trigger-${hint.id}`}
										class="radio radio-sm radio-primary"
										checked={hint.trigger === 'time'}
										onchange={() => updateHint(index, { trigger: 'time', delaySeconds: 30 })}
									/>
									<span class="label-text">Auto-reveal after</span>
								</label>
							</div>

							{#if hint.trigger === 'time'}
								<div class="flex items-center gap-2">
									<input
										type="number"
										class="input input-sm input-bordered w-20"
										min="5"
										max="600"
										step="5"
										value={hint.delaySeconds || 30}
										onchange={(e) =>
											updateHint(index, { delaySeconds: parseInt(e.currentTarget.value) || 30 })}
									/>
									<span class="text-sm text-base-content/60">seconds</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Preview Summary -->
	{#if hints.length > 0}
		<div class="mt-4 rounded-lg bg-base-200 p-3">
			<div class="text-sm font-medium">Hint Flow Preview:</div>
			<div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
				{#each hints as hint, index (hint.id)}
					<span class="badge badge-outline">
						{index + 1}.
						{hint.trigger === 'click' ? '👆 Click' : `⏱ ${hint.delaySeconds}s`}
					</span>
					{#if index < hints.length - 1}
						<span class="text-base-content/40">→</span>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>

