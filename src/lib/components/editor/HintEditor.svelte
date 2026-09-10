<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';
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
			<span class="font-medium">{i18n.cms_hints_title}</span>
			<p class="text-xs text-base-content/60">
				{i18n.cms_hints_editor_hint}
			</p>
		</div>
		<button type="button" class="btn btn-sm btn-primary" onclick={addHint}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			{i18n.cms_hints_add}
		</button>
	</div>

	{#if hints.length === 0}
		<div class="rounded-lg border-2 border-dashed border-base-300 p-6 text-center">
			<p class="text-base-content/60">{i18n.cms_hints_empty}</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each hints as hint, index (hint.id)}
				<div class="card bg-base-200">
					<div class="card-body p-4">
						<!-- Header -->
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="badge badge-neutral">{i18n.cms_hint_label} {index + 1}</span>
								<span class="text-xs text-base-content/60">
									{hint.trigger === 'click'
										? i18n.cms_hint_revealed_on_click
										: `${i18n.cms_hint_auto_reveal_after} ${hint.delaySeconds || 0}${i18n.cms_hint_seconds_short}`}
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
									class="btn text-error btn-ghost btn-xs"
									onclick={() => removeHint(hint.id)}
								>
									✕
								</button>
							</div>
						</div>

						<!-- Hint Text -->
						<LocalizedInput
							bind:value={hint.text}
							label=""
							placeholder={i18n.cms_hint_placeholder}
							type="textarea"
						/>

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
									<span class="label-text">{i18n.cms_hint_show_on_click}</span>
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
									<span class="label-text">{i18n.cms_hint_auto_reveal_after}</span>
								</label>
							</div>

							{#if hint.trigger === 'time'}
								<div class="flex items-center gap-2">
									<input
										type="number"
										class="input-bordered input input-sm w-20"
										min="5"
										max="600"
										step="5"
										value={hint.delaySeconds || 30}
										onchange={(e) =>
											updateHint(index, {
												delaySeconds: parseInt(e.currentTarget.value) || 30
											})}
									/>
									<span class="text-sm text-base-content/60">{i18n.cms_hint_seconds}</span>
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
			<div class="text-sm font-medium">{i18n.cms_hint_flow_preview}</div>
			<div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
				{#each hints as hint, index (hint.id)}
					<span class="badge badge-outline">
						{index + 1}.
						{hint.trigger === 'click'
							? `👆 ${i18n.cms_hint_click_short}`
							: `⏱ ${hint.delaySeconds}${i18n.cms_hint_seconds_short}`}
					</span>
					{#if index < hints.length - 1}
						<span class="text-base-content/40">→</span>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>
