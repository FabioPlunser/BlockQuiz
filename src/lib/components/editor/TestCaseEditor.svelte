<script lang="ts">
	import type { TestCase, TestCaseType, ExerciseType, ExerciseMode } from '$lib/types/exercise';
	import { createTestCase } from '$lib/types/exercise';
	import LocalizedInput from './LocalizedInput.svelte';

	let {
		testCases = $bindable<TestCase[]>([]),
		exerciseType = 'turtle',
		exerciseMode = 'default'
	}: {
		testCases: TestCase[];
		exerciseType: ExerciseType;
		exerciseMode: ExerciseMode;
	} = $props();

	interface TestTypeOption {
		value: TestCaseType;
		label: string;
		description: string;
		availableFor: ExerciseType[];
	}

	const testTypeOptions: TestTypeOption[] = [
		{
			value: 'target',
			label: 'Reach Target',
			description: 'Check if actor reaches a specific position',
			availableFor: ['turtle', 'robot']
		},
		{
			value: 'state',
			label: 'Final State',
			description: 'Check position and angle at the end',
			availableFor: ['turtle', 'robot']
		},
		{
			value: 'path',
			label: 'Follow Path',
			description: 'Check if actor follows the drawn path',
			availableFor: ['turtle', 'robot']
		},
		{
			value: 'commands',
			label: 'Exact Commands',
			description: 'Check exact sequence of commands',
			availableFor: ['io', 'turtle', 'robot']
		}
	];

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
		testCases = testCases.map((t, i) => (i === index ? { ...t, ...updates } : t));
	}
</script>

<div class="test-case-editor">
	<div class="mb-3 flex items-center justify-between">
		<div>
			<span class="font-medium">Test Cases</span>
			<p class="text-xs text-base-content/60">Define how the student's solution will be graded</p>
		</div>
		<button type="button" class="btn btn-primary btn-sm" onclick={addTestCase}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			Add Test
		</button>
	</div>

	{#if testCases.length === 0}
		<div class="rounded-lg border-2 border-dashed border-base-300 p-6 text-center">
			<p class="text-base-content/60">No test cases yet. Add tests to grade student solutions.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each testCases as test, index (test.id)}
				<div class="card bg-base-200">
					<div class="card-body p-4">
						<!-- Header -->
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="badge badge-neutral">Test {index + 1}</span>
								<label class="label cursor-pointer gap-2">
									<input
										type="checkbox"
										class="checkbox checkbox-sm checkbox-primary"
										checked={test.visible}
										onchange={(e) => updateTestCase(index, { visible: e.currentTarget.checked })}
									/>
									<span class="label-text text-xs">Visible to student</span>
								</label>
							</div>
							<button
								type="button"
								class="btn btn-ghost btn-xs text-error"
								onclick={() => removeTestCase(test.id)}
							>
								✕ Remove
							</button>
						</div>

						<!-- Description -->
						<LocalizedInput
							bind:value={test.description}
							label="Description"
							placeholder="What does this test check?"
						/>

						<!-- Test Type -->
						<div class="form-control mt-3">
							<label class="label">
								<span class="label-text font-medium">Test Type</span>
							</label>
							<select
								class="select select-bordered w-full"
								value={test.type}
								onchange={(e) => updateTestCase(index, { type: e.currentTarget.value as TestCaseType, expected: {} })}
							>
								{#each availableTestTypes as option (option.value)}
									<option value={option.value}>{option.label} - {option.description}</option>
								{/each}
							</select>
						</div>

						<!-- Type-specific configuration -->
						<div class="mt-3 rounded-lg bg-base-300 p-3">
							{#if test.type === 'target'}
								<div class="grid grid-cols-3 gap-3">
									<div class="form-control">
										<label class="label"><span class="label-text text-xs">Target X</span></label>
										<input
											type="number"
											class="input input-sm input-bordered"
											value={test.expected.target?.x || 200}
											onchange={(e) =>
												updateTestCase(index, {
													expected: {
														...test.expected,
														target: {
															...test.expected.target,
															x: parseInt(e.currentTarget.value) || 200,
															y: test.expected.target?.y || 200
														}
													}
												})}
										/>
									</div>
									<div class="form-control">
										<label class="label"><span class="label-text text-xs">Target Y</span></label>
										<input
											type="number"
											class="input input-sm input-bordered"
											value={test.expected.target?.y || 200}
											onchange={(e) =>
												updateTestCase(index, {
													expected: {
														...test.expected,
														target: {
															...test.expected.target,
															x: test.expected.target?.x || 200,
															y: parseInt(e.currentTarget.value) || 200
														}
													}
												})}
										/>
									</div>
									<div class="form-control">
										<label class="label"><span class="label-text text-xs">Tolerance</span></label>
										<input
											type="number"
											class="input input-sm input-bordered"
											value={test.expected.target?.tolerance || 10}
											min="1"
											max="100"
											onchange={(e) =>
												updateTestCase(index, {
													expected: {
														...test.expected,
														target: {
															...test.expected.target,
															x: test.expected.target?.x || 200,
															y: test.expected.target?.y || 200,
															tolerance: parseInt(e.currentTarget.value) || 10
														}
													}
												})}
										/>
									</div>
								</div>
							{:else if test.type === 'state'}
								<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
									<div class="form-control">
										<label class="label"><span class="label-text text-xs">X</span></label>
										<input
											type="number"
											class="input input-sm input-bordered"
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
										<label class="label"><span class="label-text text-xs">Y</span></label>
										<input
											type="number"
											class="input input-sm input-bordered"
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
										<label class="label"><span class="label-text text-xs">Angle (°)</span></label>
										<input
											type="number"
											class="input input-sm input-bordered"
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
										<label class="label"><span class="label-text text-xs">Tolerance</span></label>
										<input
											type="number"
											class="input input-sm input-bordered"
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
							{:else if test.type === 'path'}
								<div class="text-sm text-base-content/60">
									<p>
										Path will be taken from the canvas drawing. Use the canvas editor to draw the
										expected path.
									</p>
								</div>
							{:else if test.type === 'commands'}
								<div class="form-control">
									<label class="label">
										<span class="label-text text-xs">Expected commands (one per line)</span>
									</label>
									<textarea
										class="textarea textarea-bordered w-full font-mono text-xs"
										rows="4"
										placeholder="move:50&#10;turn:90&#10;move:50"
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
									label="Success message (optional)"
									placeholder="Message shown when test passes"
								/>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

