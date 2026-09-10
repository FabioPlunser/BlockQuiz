<script lang="ts">
	import LocalizedInput from './LocalizedInput.svelte';
	import { createIoTestCase, type IoNormalization, type IoTestCase } from '$lib/types/exercise';
	import { FlaskConical, Plus, Sparkles } from '@lucide/svelte';
	import { i18n } from '$lib/i18n/index.svelte';

	let {
		tests = $bindable<IoTestCase[]>([]),
		normalization = $bindable<IoNormalization>({
			trim: true,
			collapseWhitespace: false,
			caseInsensitive: false,
			normalizeLineEndings: true,
			decimalSeparator: '.'
		}),
		visibleExampleInput = $bindable<string | undefined>(''),
		visibleExampleOutput = $bindable<string | undefined>('')
	}: {
		tests: IoTestCase[];
		normalization: IoNormalization;
		visibleExampleInput?: string;
		visibleExampleOutput?: string;
	} = $props();

	function addTest() {
		tests = [...tests, createIoTestCase()];
	}

	function removeTest(id: string) {
		tests = tests.filter((test) => test.id !== id);
	}

	function updateTest(index: number, updates: Partial<IoTestCase>) {
		tests = tests.map((test, testIndex) => (testIndex === index ? { ...test, ...updates } : test));
	}

	function updateMessage(index: number, key: 'de' | 'en', value: string) {
		const current = tests[index]?.message ?? { de: '', en: '' };
		updateTest(index, {
			message: {
				...current,
				[key]: value
			}
		});
	}

	let visibleCount = $derived(tests.filter((test) => test.visible).length);
	let hiddenCount = $derived(tests.length - visibleCount);
	let showAdvancedComparison = $derived(
		normalization.trim !== true ||
			normalization.collapseWhitespace !== false ||
			normalization.caseInsensitive !== false ||
			normalization.normalizeLineEndings !== true ||
			normalization.decimalSeparator !== '.'
	);
</script>

<div class="space-y-4">
	<section class="rounded-xl border border-base-300 bg-base-100 p-4">
		<div class="flex items-start gap-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"
			>
				<Sparkles class="h-5 w-5" />
			</div>
			<div>
				<h3 class="text-base font-semibold">{i18n.cms_io_example_title}</h3>
				<p class="mt-1 text-sm text-base-content/65">
					{i18n.cms_io_example_hint}
				</p>
			</div>
		</div>

		<div class="mt-4 grid gap-4 lg:grid-cols-2">
			<label class="form-control gap-2">
				<span class="label-text font-medium">{i18n.cms_io_example_input}</span>
				<textarea
					class="textarea-bordered textarea min-h-28 w-full font-mono text-sm"
					bind:value={visibleExampleInput}
					placeholder={i18n.cms_io_example_input_placeholder}
				></textarea>
			</label>

			<label class="form-control gap-2">
				<span class="label-text font-medium">{i18n.cms_io_example_output}</span>
				<textarea
					class="textarea-bordered textarea min-h-28 w-full font-mono text-sm"
					bind:value={visibleExampleOutput}
					placeholder={i18n.cms_io_example_output_placeholder}
				></textarea>
			</label>
		</div>
	</section>

	<section class="rounded-xl border border-base-300 bg-base-100 p-4">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div class="flex items-start gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success"
				>
					<FlaskConical class="h-5 w-5" />
				</div>
				<div>
					<h3 class="text-base font-semibold">{i18n.cms_io_checks_title}</h3>
					<p class="mt-1 text-sm text-base-content/65">
						{i18n.cms_io_checks_hint}
					</p>
				</div>
			</div>

			<button type="button" class="btn gap-2 btn-sm btn-primary" onclick={addTest}>
				<Plus class="h-4 w-4" />
				{i18n.cms_io_add_check}
			</button>
		</div>

		<div class="mt-4 flex flex-wrap gap-2 text-sm text-base-content/70">
			<span class="badge badge-outline">{tests.length} {i18n.cms_io_total}</span>
			<span class="badge badge-outline">{visibleCount} {i18n.cms_io_visible}</span>
			<span class="badge badge-outline">{hiddenCount} {i18n.cms_io_hidden}</span>
		</div>

		{#if tests.length === 0}
			<div
				class="mt-4 rounded-xl border border-dashed border-base-300 bg-base-200/50 p-6 text-center"
			>
				<p class="font-medium">{i18n.cms_io_no_checks}</p>
				<p class="mt-1 text-sm text-base-content/60">
					{i18n.cms_io_no_checks_hint}
				</p>
			</div>
		{:else}
			<div class="mt-4 space-y-4">
				{#each tests as test, index (test.id)}
					<section class="rounded-xl border border-base-300 bg-base-200 p-4">
						<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
							<div class="space-y-1">
								<div class="flex flex-wrap items-center gap-2">
									<span class="badge badge-outline">{i18n.cms_io_check} {index + 1}</span>
									<span class={['badge', test.visible ? 'badge-primary' : 'badge-neutral']}>
										{test.visible ? i18n.cms_io_visible_tag : i18n.cms_io_hidden_tag}
									</span>
								</div>
								<p class="text-sm text-base-content/60">
									{i18n.cms_io_description_hint}
								</p>
							</div>

							<div class="flex flex-wrap items-center gap-2">
								<label class="label cursor-pointer gap-2 rounded-lg bg-base-100 px-3 py-2">
									<input
										type="checkbox"
										class="checkbox checkbox-sm checkbox-primary"
										checked={test.visible}
										onchange={(event) =>
											updateTest(index, { visible: event.currentTarget.checked })}
									/>
									<span class="label-text text-sm">{i18n.cms_io_visible_toggle}</span>
								</label>
								<button
									type="button"
									class="btn text-error btn-ghost btn-sm"
									onclick={() => removeTest(test.id)}
								>
									{i18n.cms_io_remove_check}
								</button>
							</div>
						</div>

						<div class="mt-4">
							<LocalizedInput bind:value={test.description} label={i18n.cms_io_check_prompt} />
						</div>

						<div class="mt-4 grid gap-4 lg:grid-cols-2">
							<label class="form-control gap-2">
								<span class="label-text font-medium">{i18n.cms_io_computer_gives}</span>
								<textarea
									class="textarea-bordered textarea min-h-28 w-full font-mono text-sm"
									value={test.stdin}
									oninput={(event) => updateTest(index, { stdin: event.currentTarget.value })}
									placeholder={i18n.cms_io_example_input_placeholder}
								></textarea>
							</label>

							<label class="form-control gap-2">
								<span class="label-text font-medium">{i18n.cms_io_program_says}</span>
								<textarea
									class="textarea-bordered textarea min-h-28 w-full font-mono text-sm"
									value={test.expectedStdout}
									oninput={(event) =>
										updateTest(index, { expectedStdout: event.currentTarget.value })}
									placeholder={i18n.cms_io_example_output_placeholder}
								></textarea>
							</label>
						</div>

						<div class="mt-4 grid gap-3 lg:grid-cols-2">
							<div class="rounded-xl bg-base-100 p-4">
								<div class="text-sm font-medium">{i18n.cms_io_success_message}</div>
								<div class="mt-3 grid gap-3 md:grid-cols-2">
									<label class="form-control gap-2">
										<span class="label-text">{i18n.language_german}</span>
										<input
											type="text"
											class="input-bordered input w-full"
											value={test.message?.de ?? ''}
											oninput={(event) => updateMessage(index, 'de', event.currentTarget.value)}
										/>
									</label>
									<label class="form-control gap-2">
										<span class="label-text">{i18n.language_english}</span>
										<input
											type="text"
											class="input-bordered input w-full"
											value={test.message?.en ?? ''}
											oninput={(event) => updateMessage(index, 'en', event.currentTarget.value)}
										/>
									</label>
								</div>
							</div>

							<div class="rounded-xl bg-base-100 p-4 text-sm text-base-content/65">
								<div class="font-medium text-base-content">{i18n.cms_io_helpful_tip}</div>
								<p class="mt-2">
									{i18n.cms_io_helpful_tip_text}
								</p>
							</div>
						</div>
					</section>
				{/each}
			</div>
		{/if}
	</section>

	<section class="rounded-xl border border-base-300 bg-base-100 p-4">
		<details class="group" open={showAdvancedComparison}>
			<summary class="cursor-pointer list-none">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h3 class="text-base font-semibold">{i18n.cms_io_advanced_title}</h3>
						<p class="mt-1 text-sm text-base-content/65">
							{i18n.cms_io_advanced_hint}
						</p>
					</div>
					<span class="badge badge-outline group-open:hidden">+</span>
					<span class="badge hidden badge-outline group-open:inline-flex">-</span>
				</div>
			</summary>

			<div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				<label
					class="label cursor-pointer justify-start gap-3 rounded-xl border border-base-300 bg-base-200 px-4 py-3"
				>
					<input
						type="checkbox"
						class="checkbox checkbox-primary"
						bind:checked={normalization.trim}
					/>
					<span class="label-text">{i18n.cms_io_ignore_edge_spaces}</span>
				</label>

				<label
					class="label cursor-pointer justify-start gap-3 rounded-xl border border-base-300 bg-base-200 px-4 py-3"
				>
					<input
						type="checkbox"
						class="checkbox checkbox-primary"
						bind:checked={normalization.collapseWhitespace}
					/>
					<span class="label-text">{i18n.cms_io_ignore_inner_spaces}</span>
				</label>

				<label
					class="label cursor-pointer justify-start gap-3 rounded-xl border border-base-300 bg-base-200 px-4 py-3"
				>
					<input
						type="checkbox"
						class="checkbox checkbox-primary"
						bind:checked={normalization.caseInsensitive}
					/>
					<span class="label-text">{i18n.cms_io_ignore_case}</span>
				</label>

				<label
					class="label cursor-pointer justify-start gap-3 rounded-xl border border-base-300 bg-base-200 px-4 py-3"
				>
					<input
						type="checkbox"
						class="checkbox checkbox-primary"
						bind:checked={normalization.normalizeLineEndings}
					/>
					<span class="label-text">{i18n.cms_io_ignore_line_breaks}</span>
				</label>

				<label class="form-control gap-2 rounded-xl border border-base-300 bg-base-200 px-4 py-3">
					<span class="label-text font-medium">{i18n.cms_io_decimal_separator}</span>
					<select class="select-bordered select" bind:value={normalization.decimalSeparator}>
						<option value=".">{i18n.cms_io_decimal_only_dot}</option>
						<option value=",">{i18n.cms_io_decimal_only_comma}</option>
						<option value="either">{i18n.cms_io_decimal_dot_or_comma}</option>
					</select>
				</label>
			</div>
		</details>
	</section>
</div>
