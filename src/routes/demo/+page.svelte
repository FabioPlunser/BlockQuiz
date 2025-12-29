<script lang="ts">
	import { browser } from '$app/environment';
	import BlocklyWorkspace from '$lib/components/BlocklyWorkspace.svelte';
	import TurtleCanvas from '$lib/components/TurtleCanvas.svelte';
	import { gradeTurtle } from '$lib/graders/turtle';
	import { Turtle } from '$lib/canvas/Turtle.svelte';
	import { Robot } from '$lib/canvas/Robot.svelte';
	import type { Point } from '$lib/canvas/types';
	import { LOGIC_BLOCKS, LOOP_BLOCKS, MATH_BLOCKS, TEXT_BLOCKS } from '$lib/blockly/presets';
	import { getCategoryToolBox, getCategoryForBlocks } from '$lib/blockly/BlocklyFactory';
	import type { BlockDef, BlocklyCategoryConfig, BlocklyToolboxConfig } from '$lib/blockly/types';
	import { BlocklyToolboxKind } from '$lib/blockly/types';
	import {
		normalizePathToCells,
		pathsEqual,
		evaluateTurtlePositionOnGrid
	} from '$lib/graders/canvas';

	type EngineKey = 'turtle' | 'robot';
	type TestMode = 'path' | 'target';

	const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	let blocklyRef: BlocklyWorkspace;
	let turtleCanvasRef: TurtleCanvas;
	let result = $state<any | null>(null);

	// Engines
	let turtle = new Turtle(400, 400);
	let robot = new Robot(400, 400);
	let currentEngine: EngineKey = $state('turtle');
	let testMode: TestMode = $state('target');

	const exercise = {
		title: 'Hungry Turtle',
		description: 'Help the turtle follow the path and eat the apple without hitting walls.',
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

	function getEngine() {
		return currentEngine === 'turtle' ? turtle : robot;
	}

	// Grid + teacher drawing config (client-side only for now)
	let appleTolerance = $state(0.5); // in cells
	let wallTolerance = $state(0.0); // in cells (0 = exact cell)

	let teacherMode = $state(true);
	let drawMode: 'path' | 'apple' | 'wall' | null = $state('path');
	let pathOverlay = $state<Point[]>([]);
	let apple = $state<Point | null>(null);
	let walls = $state<Point[]>([]);

	// Per-engine selection of which custom Canvas2D blocks to show.
	let selectedBlocks = $state<Record<EngineKey, string[]>>({
		turtle: turtle.blockDefs.map((b) => b.id),
		robot: robot.blockDefs.map((b) => b.id)
	});

	// Simple version counter used to force BlocklyWorkspace remount when toolbox changes.
	let toolboxVersion = $state(0);

	function toggleBlock(engine: EngineKey, id: string, checked: boolean) {
		const current = selectedBlocks[engine] ?? [];
		const next = checked ? [...new Set([...current, id])] : current.filter((x) => x !== id);
		selectedBlocks = { ...selectedBlocks, [engine]: next };
		toolboxVersion += 1;
	}

	function getVisibleBlocks(engineKey: EngineKey): BlockDef[] {
		const engine = engineKey === 'turtle' ? turtle : robot;
		const ids = new Set(selectedBlocks[engineKey] ?? []);
		return engine.blockDefs.filter((b) => ids.size === 0 || ids.has(b.id));
	}

	// Global selection of built-in Blockly blocks (from presets).
	const ALL_BUILTIN = [...LOGIC_BLOCKS, ...LOOP_BLOCKS, ...MATH_BLOCKS, ...TEXT_BLOCKS];
	let selectedBuiltin = $state<string[]>([...ALL_BUILTIN]);

	function toggleBuiltin(id: string, checked: boolean) {
		const next = checked
			? [...new Set([...selectedBuiltin, id])]
			: selectedBuiltin.filter((x) => x !== id);
		selectedBuiltin = next;
		toolboxVersion += 1;
	}

	function buildBuiltinCategories(): BlocklyCategoryConfig[] {
		const makeCategory = (name: string, colour: number, ids: string[]): BlocklyCategoryConfig => ({
			kind: 'category',
			name,
			colour,
			contents: ids
				.filter((id) => selectedBuiltin.includes(id))
				.map((id) => ({ kind: 'block', type: id }))
		});

		const cats: BlocklyCategoryConfig[] = [];
		const logic = makeCategory('Logic', 210, LOGIC_BLOCKS);
		if (logic.contents.length) cats.push(logic);
		const loops = makeCategory('Loops', 120, LOOP_BLOCKS);
		if (loops.contents.length) cats.push(loops);
		const math = makeCategory('Math', 230, MATH_BLOCKS);
		if (math.contents.length) cats.push(math);
		const text = makeCategory('Text', 160, TEXT_BLOCKS);
		if (text.contents.length) cats.push(text);

		return cats;
	}

	async function run() {
		if (!blocklyRef || !browser) {
			return;
		}

		const engine = getEngine();
		// Grid size is fixed (1 move step = 1 grid cell = 50px)
		engine.gridSize = 50;
		engine.api.reset();

		const code = blocklyRef.getCode();
		console.log('Generated code:', code);

		// For turtle, do an animated replay of the command sequence.
		if (currentEngine === 'turtle') {
			try {
				// 1) Dry run to fill turtle.commands
				const fn = new Function('api', code);
				fn(engine.api);
			} catch (e) {
				console.error(e);
				return;
			}

			// Copy and reset before animation
			const sequence = [...turtle.commands];
			engine.api.reset();
			turtle.commands = [];

			// 2) Animate each command with a small delay so movement is visible
			for (const cmd of sequence) {
				const [raw] = cmd.args;
				const value = Number(raw);
				if (cmd.type === 'move') {
					turtle.move(value);
				} else if (cmd.type === 'turn') {
					turtle.turn(value);
				}
				await sleep(250); // adjust speed here (ms between commands)
			}

			check();
			return;
		}

		// For other engines (robot), keep simple immediate execution for now.
		try {
			const fn = new Function('api', code);
			fn(engine.api);
		} catch (e) {
			console.error(e);
			return;
		}
	}

	function check() {
		if (!browser || currentEngine !== 'turtle') return;

		const cellSize = 50;
		const appleTol = Number(appleTolerance) || 0;
		const wallTol = Number(wallTolerance) || 0;

		// Compute turtle's current grid cell
		const col = Math.round(turtle.state.x / cellSize);
		const row = Math.round(turtle.state.y / cellSize);

		// --- Path-based grading (follow the teacher path) ---
		if (testMode === 'path' && pathOverlay.length > 1) {
			const teacherCells = normalizePathToCells(pathOverlay, cellSize);

			// Build student's path from turtle.path segment endpoints
			const studentPoints: Point[] = [];
			for (const seg of turtle.path) {
				studentPoints.push(seg.from, seg.to);
			}
			const studentCells = normalizePathToCells(studentPoints, cellSize);

			const passed = pathsEqual(teacherCells, studentCells);

			result = {
				passed,
				score: passed ? 1 : 0,
				message: passed
					? 'Great! Your turtle followed the path.'
					: 'The turtle did not follow the red path exactly. Try again.'
			};
			return;
		}

		// --- Target-based grading (apple + walls) ---
		const { wallHit, atApple } = evaluateTurtlePositionOnGrid({
			turtle: { x: turtle.state.x, y: turtle.state.y },
			walls,
			apple,
			cellSize,
			appleToleranceCells: appleTol,
			wallToleranceCells: wallTol
		});

		if (wallHit) {
			result = {
				passed: false,
				score: 0,
				message: 'Ouch! The turtle bumped into a wall. Try a different path.'
			};
			return;
		}

		if (atApple) {
			result = {
				passed: true,
				score: 1,
				message: 'Yum! The turtle ate the apple. Great job!'
			};
			return;
		}

		// Fallback to existing grader / generic feedback
		const commandLog = turtle.commands.map((cmd) =>
			cmd.args.length > 0 ? `${cmd.type}:${cmd.args.map(String).join(':')}` : cmd.type
		);
		result = gradeTurtle(commandLog, exercise.tests);
	}

	let runInterval: number | null = null;

	function toggleContinuousRun() {
		if (runInterval !== null) {
			clearInterval(runInterval);
			runInterval = null;
			return;
		}
		// Run every 1s; for real sandboxed execution you would move this into the iframe executor.
		runInterval = window.setInterval(() => {
			run();
		}, 1000);
	}

	function reset() {
		const engine = getEngine();
		engine.api.reset();
		result = null;
		// Do not clear teacher drawings here so they can be reused across runs.
	}

	let toolboxKind = $state(BlocklyToolboxKind.CATEGORY);

	function getToolBox(): BlocklyToolboxConfig {
		const engineKey = currentEngine;
		const prefix = engineKey;
		const blocks = getVisibleBlocks(engineKey);

		if (toolboxKind === BlocklyToolboxKind.CATEGORY) {
			const engineCategory = getCategoryForBlocks(
				blocks,
				prefix,
				engineKey === 'turtle' ? 'Turtle' : 'Robot',
				160
			);
			const builtinCategories = buildBuiltinCategories();
			return {
				kind: BlocklyToolboxKind.CATEGORY,
				contents: [engineCategory, ...builtinCategories]
			};
		}

		// FLYOUT toolbox: merge custom engine blocks and selected built-ins into a single flyout.
		const customToolbox = getCategoryToolBox(toolboxKind, blocks, prefix);
		const customBlocks = customToolbox ? (customToolbox.contents as any[]) : [];
		const builtinBlocks = ALL_BUILTIN.filter((id) => selectedBuiltin.includes(id)).map((id) => ({
			kind: 'block',
			type: id
		}));

		return {
			kind: BlocklyToolboxKind.FLYOUT,
			contents: [...customBlocks, ...builtinBlocks]
		};
	}
</script>

<div class="flex flex-wrap gap-4 p-4">
	<div class="form-control">
		<span class="label-text mb-1 font-semibold">Engine</span>
		<select bind:value={currentEngine} class="select-bordered select w-full max-w-xs">
			<option value="turtle">Turtle</option>
			<option value="robot">Robot</option>
		</select>
	</div>
	<div class="form-control">
		<span class="label-text mb-1 font-semibold">Toolbox Type</span>
		<select bind:value={toolboxKind} class="select-bordered select w-full max-w-xs">
			<option value={BlocklyToolboxKind.CATEGORY}>Category Toolbox</option>
			<option value={BlocklyToolboxKind.FLYOUT}>Flyout Toolbox</option>
		</select>
	</div>
	<div class="form-control">
		<span class="label-text mb-1 font-semibold">Check Mode</span>
		<select bind:value={testMode} class="select-bordered select w-full max-w-xs">
			<option value="target">Reach apple (walls matter)</option>
			<option value="path">Follow red path</option>
		</select>
	</div>
	<div class="form-control">
		<span class="label-text mb-1 font-semibold">Teacher Drawing</span>
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class="btn btn-xs"
				class:btn-primary={drawMode === 'path'}
				onclick={() => (drawMode = drawMode === 'path' ? null : 'path')}
			>
				Draw Path
			</button>
			<button
				type="button"
				class="btn btn-xs"
				class:btn-primary={drawMode === 'apple'}
				onclick={() => (drawMode = drawMode === 'apple' ? null : 'apple')}
			>
				Place Apple
			</button>
			<button
				type="button"
				class="btn btn-xs"
				class:btn-primary={drawMode === 'wall'}
				onclick={() => (drawMode = drawMode === 'wall' ? null : 'wall')}
			>
				Place Wall
			</button>
			<button
				type="button"
				class="btn btn-xs"
				onclick={() => {
					pathOverlay = [];
					apple = null;
					walls = [];
					toolboxVersion += 1;
				}}
			>
				Clear Drawing
			</button>
		</div>
	</div>
	<div class="form-control">
		<span class="label-text mb-1 font-semibold">Tolerance (cells)</span>
		<div class="flex flex-col gap-1 text-xs">
			<label class="flex items-center gap-2">
				<span>Apple</span>
				<input
					type="range"
					min="0"
					max="2"
					step="0.25"
					bind:value={appleTolerance}
					class="range w-40 range-xs"
				/>
				<span>{appleTolerance.toFixed(2)}</span>
			</label>
			<label class="flex items-center gap-2">
				<span>Wall</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.25"
					bind:value={wallTolerance}
					class="range w-40 range-xs"
				/>
				<span>{wallTolerance.toFixed(2)}</span>
			</label>
		</div>
	</div>
</div>

<div class="container mx-auto p-4">
	<h1 class="mb-2 text-3xl font-bold">{exercise.title}</h1>
	<p class="mb-2 text-lg">
		{#if currentEngine === 'turtle'}
			{exercise.description}
		{:else}
			Move the robot using the same Canvas2D blocks (no grading yet).
		{/if}
	</p>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Blockly -->
		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">Code Blocks ({currentEngine})</h2>

				<!-- Block picker: Canvas2D engine blocks -->
				<div class="mb-2 flex flex-wrap gap-3">
					{#each getEngine().blockDefs as block}
						<label class="label cursor-pointer gap-2">
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={(selectedBlocks[currentEngine] ?? []).includes(block.id)}
								onchange={(e) =>
									toggleBlock(
										currentEngine,
										block.id,
										(e.currentTarget as HTMLInputElement).checked
									)}
							/>
							<span class="label-text text-sm">{block.id}</span>
						</label>
					{/each}
				</div>

				<!-- Block picker: built-in Blockly blocks -->
				<div class="mb-4 flex flex-wrap gap-3 border-t border-base-300 pt-2">
					{#each ALL_BUILTIN as id}
						<label class="label cursor-pointer gap-2">
							<input
								type="checkbox"
								class="checkbox checkbox-xs"
								checked={selectedBuiltin.includes(id)}
								onchange={(e) => toggleBuiltin(id, (e.currentTarget as HTMLInputElement).checked)}
							/>
							<span class="label-text text-xs">{id}</span>
						</label>
					{/each}
				</div>

				{#key `${toolboxKind}-${currentEngine}-${toolboxVersion}`}
					<BlocklyWorkspace bind:this={blocklyRef} toolboxConfig={getToolBox()} />
				{/key}
			</div>
		</div>

		<!-- Canvas / Engine view -->
		<div class="card bg-base-200">
			<div class="card-body">
				<h2 class="card-title">
					{#if currentEngine === 'turtle'}
						Turtle Canvas
					{:else}
						Robot State
					{/if}
				</h2>

				{#if currentEngine === 'turtle'}
					<TurtleCanvas
						bind:turtle
						bind:this={turtleCanvasRef}
						editable={teacherMode}
						{drawMode}
						{pathOverlay}
						{apple}
						{walls}
						onPathChange={(points) => (pathOverlay = points)}
						onAppleChange={(p) => (apple = p)}
						onWallsChange={(w) => (walls = w)}
					/>
				{:else}
					<div class="mt-2 space-y-1">
						<p>X: {robot.state.x.toFixed(1)}</p>
						<p>Y: {robot.state.y.toFixed(1)}</p>
						<p>Angle: {robot.state.angle.toFixed(1)}</p>
					</div>
				{/if}

				<!-- Controls -->
				<div class="mt-4 flex flex-wrap gap-2">
					<button class="btn btn-primary" onclick={() => run()}>Run</button>
					<button
						class="btn btn-outline btn-primary"
						type="button"
						onclick={() => toggleContinuousRun()}
					>
						Run continuously
					</button>
					<button
						class="btn btn-secondary"
						onclick={() => check()}
						disabled={currentEngine !== 'turtle'}
						title={currentEngine !== 'turtle' ? 'Grading only available for Turtle' : ''}
					>
						Check
					</button>
					<button class="btn btn-info" onclick={() => reset()}>Reset</button>
				</div>

				<!-- Result -->
				{#if result && currentEngine === 'turtle'}
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
					<div class="mt-2 space-y-1">
						<h3 class="text-xl">
							Grade:
							{#if typeof result.score === 'number'}
								{Math.round(result.score * 100)}%
							{:else}
								–
							{/if}
						</h3>
						{#if result.message}
							<p class="text-sm text-base-content/80">{result.message}</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
