<script lang="ts">
	import { browser } from '$app/environment';
	import BlocklyWorkspace from '$lib/components/BlocklyWorkspace.svelte';
	import TurtleCanvas from '$lib/components/TurtleCanvas.svelte';
	import { gradeTurtle } from '$lib/graders/turtle';
	import '$lib/blockly/turtleBlocks';
	import { onMount } from 'svelte';

	let blocklyRef: BlocklyWorkspace;
	let turtleRef: TurtleCanvas;
	let result: any = null;

	const exercise = {
		title: 'Draw a Line',
		description: 'Move the turlte 100 steps forward!',
		toolbox: ['turtle_move', 'turtle_turn', 'math_number', 'controls_repeat_ext'],
		tests: [
			{
				id: 'test1',
				description: { de: 'Schildkröte bewegt sich', en: 'Turtle moves' },
				visible: true,
				type: 'state' as const,
				expected: {
					state: {
						x: 200,
						y: 100,
						angle: 0,
						tolerance: 15
					}
				}
			}
		]
	};

	function run() {
		if (!blocklyRef || !turtleRef || !browser) {
			return;
		}
		console.log('Running code...');
		turtleRef.api.reset();

		const code = blocklyRef.getCode();
		const xml = blocklyRef.getXml();
		console.log('Generated code:', code);
		console.log('Workspace XML:', xml);

		const turtle = {
			move: (dist: number) => turtleRef.api.move(dist),
			turn: (deg: number) => turtleRef.api.turn(deg),
			penDown: () => turtleRef.api.penDown(),
			penUp: () => turtleRef.api.penUp(),
			color: (hex: string) => turtleRef.api.color(hex),
			reset: () => turtleRef.api.reset()
		};

		try {
			const fn = new Function('turtle', code);
			fn(turtle);
		} catch (e) {
			console.error(e);
		}
	}

	function check() {
		if (!turtleRef || !browser) return;
		const commandLog = turtleRef.api.getLog();
		console.log('Command log:', commandLog);
		result = gradeTurtle(commandLog, exercise.tests);
		console.log('Grade result:', result);
	}

	function reset() {
		turtleRef?.api.reset();
		result = null;
	}

	onMount(() => {
		console.log('Hallo');
		console.log('Hallo', blocklyRef);
		console.log(turtleRef);
	});
</script>

<div class="container mx-auto p-4">
	<h1 class="mb-2 text-3xl font-bold">{exercise.title}</h1>
	<p class="mb-2 text-lg">{exercise.description}</p>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Blockly -->
		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-titel">Code Blocks</h2>
				<BlocklyWorkspace readOnly={false} bind:this={blocklyRef} toolbox={exercise.toolbox} />
			</div>
		</div>

		<!-- Turtle -->
		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-titel">Turtle Canvas</h2>
				<TurtleCanvas bind:this={turtleRef} width={400} height={400} />
				<!-- Controls -->
				<div class="mt-4 flex gap-2">
					<button class="btn btn-primary" onclick={() => run()}>Run</button>
					<button class="btn btn-secondary" onclick={() => check()}>Check</button>
					<button class="btn btn-info" onclick={() => reset()}>Reset</button>
				</div>

				<!-- Result -->
				{#if result}
					<div
						class="mt-4 alert"
						class:alert-success={result.passed}
						class:alert-error={!result.passed}
					>
						{#if result.passed}
							<span class="text-2xl">🎊 Correct! Great Job!</span>
						{:else}
							<span class="text-2xl">😢 Incorrect. Try again!</span>
						{/if}
					</div>
					<div class="mt-2">
						<h3 class="text-xl">Grade: {Math.round(result.score * 100)}%</h3>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
