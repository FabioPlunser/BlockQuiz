<script lang="ts">
	import Icon from '@iconify/svelte';
	import { browser } from '$app/environment';
	import BlocklyWorkspace from '$cp/BlocklyWorkspace.svelte';
	import TurtleCanvas from '$cp/TurtleCanvas.svelte';

	import { TURTLE_BLOCKS } from '$lib/blockly/turtleBlocks';

	let defaultExercise: {
		type: 'io' | 'turtle';
		content: {
			title: { de: string; en: string };
			description: { de: string; en: string };
			hints: Array<{ de: string; en: string }>;
			example?: {
				description: { de: string; en: string };
				starterXml: string;
				explanation: { de: string; en: string };
			};
		};
		toolbox: string[];
		starterXml?: string;
		grader: {
			type: 'turtle' | 'io';
			target?: { x: number; y: number; tolerance: number };
			expectedCommands?: string[];
			pathOverlay?: { points: Array<{ x: number; y: number }>; color: string; width: number };
			tests: Array<unknown>;
		};
	};

	let { exercise = $bindable(defaultExercise) } = $props();

	let blocklyRef: BlocklyWorkspace;
	let turtleRef: TurtleCanvas;
	let currentLang: 'de' | 'en' = 'de';

	const availableBlocks = [
		...TURTLE_BLOCKS,
		'controls_repeat_ext',
		'controls_if',
		'math_number',
		'math_arithmetic'
	];

	function toggleBlock(blockType: string) {
		if (exercise.toolbox.includes(blockType)) {
			exercise.toolbox = exercise.toolbox.filter((b) => b !== blockType);
		} else {
			exercise.toolbox = [...exercise.toolbox, blockType];
		}
	}

	function runSolution() {
		if (!blocklyRef || !turtleRef) return;
		turtleRef.api.reset();

		const code = blocklyRef.getCode();

		const turtle = {
			move: (dist: number) => turtleRef.api.move(dist),
			turn: (deg: number) => turtleRef.api.turn(deg),
			penUp: () => turtleRef.api.penUp(),
			penDown: () => turtleRef.api.penDown(),
			color: (color: string) => turtleRef.api.color(color),
			reset: () => turtleRef.api.reset()
		};

		try {
			const fn = new Function('turtle', code);
			fn(turtle);
		} catch (e) {
			console.error('Execution error: ', e);
		}
	}

	function addHint() {
		exercise.content.hints = [...exercise.content.hints, { de: '', en: '' }];
	}

	function removeHint(index: number) {
		exercise.content.hints = exercise.content.hints.filter((_, i) => i !== index);
	}

	function addPathPoint() {
		if (!exercise.grader.pathOverlay) {
			exercise.grader.pathOverlay = { points: [] };
		}
		exercise.grader.pathOverlay.points = [
			...exercise.grader.pathOverlay.points,
			{ x: 200, y: 200 }
		];
	}

	function recordSolution() {
		if (!turtleRef) return;
		const commands = turtleRef.api.getLog();
		exercise.grader.expectedCommands = commands;
	}
</script>

<div class="flex flex-col gap-6">
	<!-- Language Toggle -->
	<div class="tabs-box tabs w-fit">
		<button
			class="tab-lg tab-lifted tab"
			class:tab-active={currentLang === 'de'}
			on:click={() => (currentLang = 'de')}>Deutsch</button
		>
		<button
			class="tab-lg tab-lifted tab"
			class:tab-active={currentLang === 'en'}
			on:click={() => (currentLang = 'en')}>English</button
		>
	</div>

	<!-- Title & Description -->
	<fieldset class="fieldset">
		<legend class="fieldset-legend">Titel ({currentLang.toUpperCase()})</legend>
		<input
			type="text"
			bind:value={exercise.content.title[currentLang]}
			placeholder="Exercise Title .."
		/>
	</fieldset>

	<fieldset class="fieldset">
		<legend class="fieldset-legend">Beschreibung ({currentLang.toUpperCase()})</legend>
		<textarea bind:value={exercise.content.description[currentLang]} />
	</fieldset>

	<!-- Example Seclection  -->
	<fieldset class="fieldset">
		<legend class="fieldset-legend">Example (for students to learn from)</legend>
		<div class="flex flex-col gap-4">
			<div>
				<label class="label">Example Description ({currentLang.toUpperCase()})</label>
				<textarea
					class="textarea h-20 w-full"
					bind:value={exercise.content.example.description[currentLang]}
					placeholder="Explain what this example shows..."
				></textarea>
			</div>
			<div>
				<label class="label">Example Explanation ({currentLang.toUpperCase()})</label>
				<textarea
					class="textarea h-20 w-full"
					bind:value={exercise.content.example.explanation[currentLang]}
					placeholder="Step-by-step explanation..."
				></textarea>
			</div>
		</div>
	</fieldset>

	<!-- Hints -->
	<fieldset class="fieldset">
		<legend class="fieldset-legend">Hints ({currentLang.toUpperCase()})</legend>
		{#each exercise.content.hints as hint, i (i)}
			<div class="mb-2 flex items-center gap-2">
				<span class="badge badge-neutral">Hint {i + 1}</span>
				<input type="text" bind:value={hint[currentLang]} placeholder="Hint {i + 1}" />
				<button class="btn btn-circle btn-ghost btn-sm" on:click={() => removeHint(i)}
					><Icon name="x" /></button
				>
			</div>
		{/each}
		<button class="btn btn-circle btn-ghost btn-sm" on:click={addHint}><Icon name="plus" /></button>
	</fieldset>

	<!-- Toolbox Selection -->
	<fieldset class="fieldset">
		<legend class="fieldset-legend">Toolbox ({currentLang.toUpperCase()})</legend>
		<div class="flex flex-wrap gap-2">
			{#each availableBlocks as block (block)}
				<label class="cursor-pointer">
					<input
						type="checkbox"
						class="checkbox"
						checked={exercise.toolbox.includes(block)}
						on:change={() => toggleBlock(block)}
					/>
					<span class="label-text">{block}</span>
				</label>
			{/each}
		</div>
	</fieldset>

	{#if exercise.type === 'turtle'}
		<!-- Turtle Exercise Builder -->
		<div class="grid grid-cols-2 gap-4">
			<div>
				<h3 class="mb-2 text-lg font-bold">Build Solution</h3>
				{#if browser}
					<BlocklyWorkspace bind:this={blocklyRef} toolbox={exercise.toolbox} />
				{/if}
				<button class="btn btn-primary" onclick={runSolution}>Run</button>
				<button class="btn btn-secondary" onclick={recordSolution}>Record as Solution</button>
			</div>
			<div>
				<h3 class="mb-2 text-lg font-bold">Canvas Preview</h3>
				<TurtleCanvas bind:this={turtleRef} width={400} height={400} />

				<!-- Target Point Editor -->
				{#if exercise.grader.target}
					<div class="mt-4">
						<h4 class="font-semibold">Target Point</h4>
						<div class="flex gap-2">
							<label class="label">
								X:
								<input
									type="number"
									class="input input-sm w-20"
									bind:value={exercise.grader.target.x}
								/>
							</label>
							<label class="label">
								Y:
								<input
									type="number"
									class="input input-sm w-20"
									bind:value={exercise.grader.target.y}
								/>
							</label>
							<label class="label">
								Tolerance:
								<input
									type="number"
									class="input input-sm w-20"
									bind:value={exercise.grader.target.tolerance}
								/>
							</label>
						</div>
					</div>
				{/if}

				<!-- Path Points Editor -->
				<div class="mt-4">
					<h4 class="font-semibold">Path Overlay (optional)</h4>
					<button class="btn btn-sm" onclick={addPathPoint}>+ Add Point</button>
					{#if exercise.grader.pathOverlay?.points}
						{#each exercise.grader.pathOverlay.points as point, i (i)}
							<div class="flex gap-2">
								<input
									type="number"
									class="input input-sm w-16"
									bind:value={point.x}
									placeholder="X"
								/>
								<input
									type="number"
									class="input input-sm w-16"
									bind:value={point.y}
									placeholder="Y"
								/>
								<button
									class="btn btn-sm btn-error"
									onclick={() => {
										exercise.grader.pathOverlay.points = exercise.grader.pathOverlay.points.filter(
											(_, idx) => idx !== i
										);
									}}>×</button
								>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
