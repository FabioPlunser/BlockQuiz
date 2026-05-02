<script lang="ts">
	import type { TestCase, TestCaseType, ExerciseType } from '$lib/types/exercise';
	import { createTestCase } from '$lib/types/exercise';
	import { i18n } from '$lib/i18n/index.svelte';
	import LocalizedInput from './LocalizedInput.svelte';
	import { Terminal, Compass, Plus } from '@lucide/svelte';

	let {
		testCases = $bindable<TestCase[]>([]),
		exerciseType = 'turtle'
	}: {
		testCases: TestCase[];
		exerciseType: ExerciseType;
	} = $props();

	// Only show manual tests (state/commands) - auto-generated tests are in AutoTestsPanel
	let manualTests = $derived(testCases.filter((t) => t.type !== 'target' && t.type !== 'path'));

	interface TestTypeOption {
		value: TestCaseType;
		label: string;
		description: string;
		availableFor: ExerciseType[];
	}

	let testTypeOptions = $derived<TestTypeOption[]>([
		{
			value: 'state',
			label: i18n.cms_manual_test_state,
			description: i18n.cms_manual_test_state_desc,
			availableFor: ['turtle', 'robot']
		},
		{
			value: 'commands',
			label: i18n.cms_manual_test_commands,
			description: i18n.cms_manual_test_commands_desc,
			availableFor: ['io', 'turtle', 'robot']
		}
	]);

	let availableTestTypes = $derived(
		testTypeOptions.filter((t) => t.availableFor.includes(exerciseType))
	);

	function addTestCase() {
		const newTest = createTestCase();
		// Default to first available type
		if (availableTestTypes.length > 0) {
			newTest.type = availableTestTypes[0].value;
		}
		testCases = [...testCases, newTest];
	}

	function removeTestCase(id: string) {
		testCases = testCases.filter((t) => t.id !== id);
	}

	function updateTestCase(index: number, updates: Partial<TestCase>) {
		// Find the actual index in the full testCases array
		const manualTest = manualTests[index];
		const actualIndex = testCases.findIndex((t) => t.id === manualTest.id);
		if (actualIndex !== -1) {
			testCases = testCases.map((t, i) => (i === actualIndex ? { ...t, ...updates } : t));
		}
	}
</script>

<div class="manual-test-editor">
	<!-- Header -->
	<div class="mb-4 flex items-center justify-between">
		<div>
			<h3 class="font-medium">{i18n.cms_manual_tests_header}</h3>
			<p class="text-xs text-base-content/60">
				{i18n.cms_manual_tests_header_hint}
			</p>
		</div>
		{#if availableTestTypes.length > 0}
			<button type="button" class="btn gap-1 btn-sm btn-primary" onclick={addTestCase}>
				<Plus size="16" />
				{i18n.cms_manual_tests_add}
			</button>
		{/if}
	</div>

	{#if manualTests.length === 0}
		<div class="rounded-lg border-2 border-dashed border-base-300 p-6 text-center">
			<p class="text-sm text-base-content/60">
				{i18n.cms_manual_tests_empty}
			</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each manualTests as test, index (test.id)}
				<div class="card bg-base-300">
					<div class="card-body p-4">
						<!-- Header -->
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center gap-2">
								{#if test.type === 'state'}
									<Compass class="h-4 w-4" />
								{:else if test.type === 'commands'}
									<Terminal class="h-4 w-4" />
								{/if}
								<span class="badge badge-neutral">
									{test.type === 'state'
										? i18n.cms_manual_test_state
										: i18n.cms_manual_test_commands}
								</span>
								<label class="label cursor-pointer gap-2">
									<input
										type="checkbox"
										class="checkbox checkbox-sm checkbox-primary"
										checked={test.visible}
										onchange={(e) => updateTestCase(index, { visible: e.currentTarget.checked })}
									/>
									<span class="label-text text-xs">{i18n.cms_manual_test_visible}</span>
								</label>
							</div>
							<button
								type="button"
								class="btn text-error btn-ghost btn-xs"
								onclick={() => removeTestCase(test.id)}
							>
								✕ {i18n.cms_manual_test_remove}
							</button>
						</div>

						<!-- Test Type Selector -->
						<div class="form-control mb-3">
							<label class="label py-1" for={`manual-test-${test.id}-type`}>
								<span class="label-text text-xs font-medium">{i18n.cms_manual_test_type}</span>
							</label>
							<select
								id={`manual-test-${test.id}-type`}
								class="select-bordered select w-full select-sm"
								value={test.type}
								onchange={(e) =>
									updateTestCase(index, {
										type: e.currentTarget.value as TestCaseType,
										expected: {}
									})}
							>
								{#each availableTestTypes as option (option.value)}
									<option value={option.value}>{option.label} - {option.description}</option>
								{/each}
							</select>
						</div>

						<!-- Description -->
						<LocalizedInput
							bind:value={test.description}
							label={i18n.cms_manual_test_description}
							placeholder={i18n.cms_manual_test_description_placeholder}
						/>

						<!-- Type-specific configuration -->
						<div class="mt-3 rounded-lg bg-base-200 p-3">
							{#if test.type === 'state'}
								<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
									<div class="form-control">
										<label class="label" for={`manual-test-${test.id}-x`}>
											<span class="label-text text-xs">{i18n.cms_manual_test_x_position}</span>
										</label>
										<input
											id={`manual-test-${test.id}-x`}
											type="number"
											class="input-bordered input input-sm"
											value={test.expected.state?.x || 200}
											onchange={(e) =>
												updateTestCase(index, {
													expected: {
														...test.expected,
														state: {
															...test.expected.state,
															x: parseInt(e.currentTarget.value) || 200,
															y: test.expected.state?.y || 200,
															angle: test.expected.state?.angle || 0,
															tolerance: test.expected.state?.tolerance || 10
														}
													}
												})}
										/>
									</div>
									<div class="form-control">
										<label class="label" for={`manual-test-${test.id}-y`}>
											<span class="label-text text-xs">{i18n.cms_manual_test_y_position}</span>
										</label>
										<input
											id={`manual-test-${test.id}-y`}
											type="number"
											class="input-bordered input input-sm"
											value={test.expected.state?.y || 200}
											onchange={(e) =>
												updateTestCase(index, {
													expected: {
														...test.expected,
														state: {
															x: test.expected.state?.x || 200,
															y: parseInt(e.currentTarget.value) || 200,
															angle: test.expected.state?.angle || 0,
															tolerance: test.expected.state?.tolerance || 10
														}
													}
												})}
										/>
									</div>
									<div class="form-control">
										<label class="label" for={`manual-test-${test.id}-angle`}>
											<span class="label-text text-xs">{i18n.cms_manual_test_angle_degrees}</span>
										</label>
										<input
											id={`manual-test-${test.id}-angle`}
											type="number"
											class="input-bordered input input-sm"
											value={test.expected.state?.angle || 0}
											min="0"
											max="360"
											onchange={(e) =>
												updateTestCase(index, {
													expected: {
														...test.expected,
														state: {
															x: test.expected.state?.x || 200,
															y: test.expected.state?.y || 200,
															angle: parseInt(e.currentTarget.value) || 0,
															tolerance: test.expected.state?.tolerance || 10
														}
													}
												})}
										/>
									</div>
									<div class="form-control">
										<label class="label" for={`manual-test-${test.id}-tolerance`}>
											<span class="label-text text-xs">{i18n.cms_manual_test_tolerance}</span>
										</label>
										<input
											id={`manual-test-${test.id}-tolerance`}
											type="number"
											class="input-bordered input input-sm"
											value={test.expected.state?.tolerance || 10}
											min="1"
											max="100"
											onchange={(e) =>
												updateTestCase(index, {
													expected: {
														...test.expected,
														state: {
															x: test.expected.state?.x || 200,
															y: test.expected.state?.y || 200,
															angle: test.expected.state?.angle || 0,
															tolerance: parseInt(e.currentTarget.value) || 10
														}
													}
												})}
										/>
									</div>
								</div>
							{:else if test.type === 'commands'}
								<div class="form-control">
									<label class="label" for={`manual-test-${test.id}-commands`}>
										<span class="label-text text-xs">{i18n.cms_manual_test_expected_commands}</span>
									</label>
									<textarea
										id={`manual-test-${test.id}-commands`}
										class="textarea-bordered textarea w-full font-mono text-xs"
										rows="4"
										placeholder={i18n.cms_manual_test_expected_commands_placeholder}
										value={(test.expected.commands || []).join('\n')}
										onchange={(e) =>
											updateTestCase(index, {
												expected: {
													...test.expected,
													commands: e.currentTarget.value
														.split('\n')
														.map((s) => s.trim())
														.filter(Boolean)
												}
											})}
									></textarea>
								</div>
							{/if}
						</div>

						<!-- Optional success message -->
						{#if test.message}
							<div class="mt-3">
								<LocalizedInput
									bind:value={test.message}
									label={i18n.cms_manual_test_success}
									placeholder={i18n.cms_manual_test_success_placeholder}
								/>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
