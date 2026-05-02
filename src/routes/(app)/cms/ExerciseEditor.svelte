<script lang="ts">
	import LocalizedRichText from '$cp/editor/LocalizedRichText.svelte';
	import LocalizedInput from '$cp/editor/LocalizedInput.svelte';
	import TypeModeSelector from '$cp/editor/TypeModeSelector.svelte';
	import BlockPicker from '$cp/editor/BlockPicker.svelte';
	import type {
		Exercise,
		ExerciseFormData,
		TestCase,
		PublishValidationResult,
		RobotGridConfig
	} from '$types/exercise';
	import { canonicalizeExercise, validateExercise } from '$types/exercise';
	import { MoveLeft } from '@lucide/svelte';

	import {
		Info,
		Blocks,
		Palette,
		FlaskConical,
		Lightbulb,
		Eye,
		Brush,
		Apple,
		BrickWall,
		Trash,
		ChevronDown,
		ChevronRight,
		Grid3X3,
		History,
		RotateCcw
	} from '@lucide/svelte';
	import { createDefaultExerciseFormData } from '$types/exercise';
	import BlocklyWorkspace from '$cp/BlocklyWorkspace.svelte';
	import type { BlocklyToolboxConfig, BlocklyCategoryConfig } from '$lib/blockly/types';
	import { BlocklyToolboxKind } from '$lib/blockly/types';
	import { Turtle } from '$lib/canvas/Turtle.svelte';
	import { Robot } from '$lib/canvas/Robot.svelte';
	import { getCategoryForBlocks } from '$lib/blockly/BlocklyFactory';
	import { LOGIC_BLOCKS, LOOP_BLOCKS, MATH_BLOCKS, TEXT_BLOCKS } from '$lib/blockly/presets';
	import { watch } from 'runed';
	import Canvas from '$cp/Canvas.svelte';
	import type { DrawMode, Point, TargetPoint } from '$lib/canvas/types';
	import TestCaseEditor from '$cp/editor/TestCaseEditor.svelte';
	import HintEditor from '$cp/editor/HintEditor.svelte';
	import AutoTestsPanel from '$cp/editor/AutoTestsPanel.svelte';
	import IoTestsEditor from '$cp/editor/IoTestsEditor.svelte';
	import ExercisePlayer from '$cp/player/ExercisePlayer.svelte';
	import ConfirmModal from '$cp/ConfirmModal.svelte';
	import {
		createExercise,
		getExercise,
		getExerciseVersions,
		restoreExerciseVersion,
		updateExercise
	} from '$remote/exercises.remote';
	import { handleServerResult, showError } from '$lib/utils/toast';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';

	// ---------------------------------------------------
	// ---------------------------------------------------
	type Props = {
		exercise?: ExerciseFormData;
		remote?: any;
		onSave?: () => void;
		onCancel: () => void;
		isNew?: boolean;
	};

	let {
		exercise = $bindable(createDefaultExerciseFormData()),
		remote,
		onSave,
		onCancel,
		isNew = true
	}: Props = $props();
	// ---------------------------------------------------
	// ---------------------------------------------------
	let activeSection = $state<string>('basics');

	let showGrid = $state(true);
	let drawMode = $state<DrawMode>(null);
	let blocklyRef = $state<BlocklyWorkspace | undefined>(undefined);
	let toolboxVersion = $state(0);
	let starterWorkspaceVersion = $state(0);
	let showManualTests = $state(false);
	let validationResult = $state<PublishValidationResult | null>(null);
	let restoringVersionId = $state<string | null>(null);
	let pendingRestoreVersionId = $state<string | null>(null);
	let restoreVersionConfirmOpen = $state(false);

	type ExerciseVersionItem = {
		id: string;
		message: string;
		createdBy: string;
		createdAt: number;
		type: string | null;
		published: boolean | null;
		title: unknown;
	};

	let versionHistory = $derived(
		exercise.id ? getExerciseVersions({ exerciseId: exercise.id }) : null
	);
	let versionItems = $derived((versionHistory?.current as ExerciseVersionItem[]) ?? []);

	function toExerciseFormData(next: Exercise): ExerciseFormData {
		return {
			id: next.id,
			courseId: next.courseId,
			type: next.type,
			content: structuredClone(next.content),
			config: structuredClone(next.config),
			published: next.published,
			order: next.order
		};
	}

	function applyExercise(next: Exercise) {
		exercise = toExerciseFormData(next);
		validationResult = next.validation;
		toolboxVersion += 1;
		starterWorkspaceVersion += 1;
		previewVersion += 1;
	}

	function getVersionTitle(version: ExerciseVersionItem) {
		const value = version.title;
		if (value && typeof value === 'object' && 'title' in value) {
			return getLocalized((value as { title: { de: string; en: string } }).title);
		}

		return '';
	}

	async function refreshEditorExercise() {
		if (!exercise.id) return;
		const latest = getExercise({ id: exercise.id });
		await latest.refresh();
		if (latest.current) {
			applyExercise(latest.current as Exercise);
		}
	}

	function runValidation(): PublishValidationResult {
		const hydrated = canonicalizeExercise({
			id: exercise.id ?? 'validation-check',
			courseId: exercise.courseId,
			type: exercise.type,
			content: exercise.content,
			config: exercise.config,
			published: exercise.published,
			order: exercise.order
		});
		return validateExercise(hydrated);
	}

	function handlePublishToggle(e: Event) {
		const checked = (e.target as HTMLInputElement).checked;
		if (checked) {
			const result = runValidation();
			validationResult = result;
			if (!result.valid) {
				exercise.published = false;
				return;
			}
		}
		exercise.published = checked;
		if (!checked) validationResult = null;
	}

	let isRobot = $derived(exercise.type === 'robot');
	let pathOverlay = $derived(exercise.config.canvas.pathOverlay);
	let targets = $derived<TargetPoint[]>(
		isRobot
			? exercise.config.grid.targets.map((target) => ({ ...target }))
			: exercise.config.canvas.targets
	);
	let walls = $derived(isRobot ? exercise.config.grid.walls : exercise.config.canvas.walls);
	let canvasGridSize = $derived(
		isRobot ? exercise.config.grid.cellSize : exercise.config.canvas.gridSize
	);

	// Derived counts for UI feedback
	let targetCount = $derived(targets.length);
	let pathPointCount = $derived(pathOverlay.length);
	let selectedBlockCount = $derived(exercise.config.toolbox.length);
	let starterWorkspaceKey = $derived(`starter-${toolboxVersion}-${starterWorkspaceVersion}`);
	let previewVersion = $state(0);
	let previewExercise = $derived(
		canonicalizeExercise({
			id: exercise.id ?? 'preview-exercise',
			courseId: exercise.courseId,
			type: exercise.type,
			content: exercise.content,
			config: exercise.config,
			published: exercise.published,
			order: exercise.order
		})
	);

	$effect(() => {
		if (exercise.type === 'io') {
			exercise.config.io.visibleExampleInput ??= '';
			exercise.config.io.visibleExampleOutput ??= '';
		}
	});

	function updatePath(points: Point[]) {
		exercise.config.canvas.pathOverlay = points;
	}

	function updateTargets(t: TargetPoint[]) {
		if (isRobot) {
			exercise.config.grid.targets = t.map(({ x, y }) => ({ x, y }));
		} else {
			exercise.config.canvas.targets = t;
		}
	}

	function updateWalls(w: Point[]) {
		if (isRobot) {
			exercise.config.grid.walls = w;
		} else {
			exercise.config.canvas.walls = w;
		}
	}

	const sections = $derived([
		{ id: 'basics', label: i18n.cms_exercise_section_basics, icon: Info },
		{ id: 'blocks', label: i18n.cms_exercise_section_blocks, icon: Blocks },
		{
			id: 'canvas',
			label:
				exercise.type === 'io'
					? i18n.cms_exercise_section_io
					: isRobot
						? i18n.cms_exercise_section_grid
						: i18n.cms_exercise_section_canvas,
			icon: exercise.type === 'io' ? FlaskConical : Palette
		},
		{ id: 'hints', label: i18n.cms_exercise_section_hints, icon: Lightbulb },
		{ id: 'preview', label: i18n.cms_exercise_section_preview, icon: Eye }
	]);
	// ---------------------------------------------------
	// Blockly
	// ---------------------------------------------------
	function getEngine() {
		if (exercise.type === 'io') {
			return null;
		}

		if (exercise.type === 'turtle') {
			return new Turtle(400, 400);
		}

		const { width, height, cellSize, start, direction } = exercise.config.grid;
		const engine = new Robot(width * cellSize, height * cellSize, { start, direction });
		engine.gridSize = cellSize;
		return engine;
	}
	// Build toolbox config from selected blocks
	function buildBuiltinCategories(): BlocklyCategoryConfig[] {
		const makeCategory = (name: string, colour: number, ids: string[]): BlocklyCategoryConfig => ({
			kind: 'category',
			name,
			colour,
			contents: ids
				.filter((id) => exercise.config.toolbox.includes(id))
				.map((id) => ({ kind: 'block', type: id }))
		});

		const cats: BlocklyCategoryConfig[] = [];
		const logic = makeCategory(i18n.toolbox_logic, 210, LOGIC_BLOCKS);
		if (logic.contents.length) cats.push(logic);
		const loops = makeCategory(i18n.toolbox_loops, 120, LOOP_BLOCKS);
		if (loops.contents.length) cats.push(loops);
		const math = makeCategory(i18n.toolbox_math, 230, MATH_BLOCKS);
		if (math.contents.length) cats.push(math);
		const text = makeCategory(i18n.toolbox_text, 160, TEXT_BLOCKS);
		if (text.contents.length) cats.push(text);

		return cats;
	}

	function getToolbox(): BlocklyToolboxConfig {
		if (exercise.type === 'io') {
			return {
				kind: BlocklyToolboxKind.CATEGORY,
				contents: buildBuiltinCategories()
			};
		}

		const engine = getEngine();
		const prefix = exercise.type;

		// Filter engine blocks by selected
		const engineBlocks =
			engine?.blockDefs.filter((b) => exercise.config.toolbox.includes(b.id)) ?? [];

		const engineCategory = getCategoryForBlocks(
			engineBlocks,
			prefix,
			exercise.type === 'turtle' ? i18n.toolbox_turtle : i18n.toolbox_robot,
			160
		);

		const builtinCategories = buildBuiltinCategories();

		return {
			kind: BlocklyToolboxKind.CATEGORY,
			contents: [engineCategory, ...builtinCategories].filter(Boolean)
		};
	}

	watch(
		() => exercise.config.toolbox,
		() => {
			toolboxVersion += 1;
		}
	);
	function captureStarterXml() {
		if (blocklyRef) {
			exercise.config.starterXml = blocklyRef.getXml();
			exercise.config.hasStarterBlocks = true;
		}
	}

	function toggleStarterBlocks(enabled: boolean) {
		exercise.config.hasStarterBlocks = enabled;
		starterWorkspaceVersion += 1;
	}

	function resetStarterWorkspace() {
		starterWorkspaceVersion += 1;
	}

	function clearStarterXml() {
		exercise.config.starterXml = '';
		exercise.config.hasStarterBlocks = false;
		if (blocklyRef) {
			blocklyRef.clear();
		}
		starterWorkspaceVersion += 1;
	}
	// ---------------------------------------------------
	// Canvas
	// ---------------------------------------------------
	function clearCanvas() {
		exercise.config.canvas.pathOverlay = [];
		if (isRobot) {
			exercise.config.grid.targets = [];
			exercise.config.grid.walls = [];
		} else {
			exercise.config.canvas.targets = [];
			exercise.config.canvas.walls = [];
		}
	}

	function parseNumberInput(event: Event, fallback: number) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		return Number.isFinite(value) ? value : fallback;
	}

	function clamp(value: number, min: number, max: number) {
		return Math.min(max, Math.max(min, value));
	}

	function clampInteger(value: number, min: number, max: number) {
		return Math.round(clamp(value, min, max));
	}

	function clampRobotStart() {
		const grid = exercise.config.grid;
		grid.start.x = clamp(grid.start.x, 0, grid.width * grid.cellSize);
		grid.start.y = clamp(grid.start.y, 0, grid.height * grid.cellSize);
	}

	function updateRobotGridDimension(field: 'width' | 'height', event: Event) {
		exercise.config.grid[field] = clampInteger(
			parseNumberInput(event, exercise.config.grid[field]),
			1,
			100
		);
		clampRobotStart();
	}

	function updateRobotGridCellSize(event: Event) {
		exercise.config.grid.cellSize = clampInteger(
			parseNumberInput(event, exercise.config.grid.cellSize),
			1,
			200
		);
		clampRobotStart();
	}

	function updateRobotGridStart(field: 'x' | 'y', event: Event) {
		const grid = exercise.config.grid;
		const max = field === 'x' ? grid.width * grid.cellSize : grid.height * grid.cellSize;
		grid.start[field] = clamp(parseNumberInput(event, grid.start[field]), 0, max);
	}

	function updateRobotGridDirection(event: Event) {
		exercise.config.grid.direction = (event.currentTarget as HTMLSelectElement)
			.value as RobotGridConfig['direction'];
	}

	// ---------------------------------------------------
	// Auto-sync Canvas → Test Cases
	// ---------------------------------------------------

	/**
	 * Sync canvas targets to test cases.
	 * Clears all existing 'target' type test cases and creates new ones from canvas targets.
	 */
	function syncTargetsToTests() {
		const tolerance = exercise.config.grader.appleTolerance ?? 10;
		const canvasTargets = targets;

		// Remove all existing target-type test cases
		const nonTargetTests = exercise.config.grader.testCases.filter((t) => t.type !== 'target');

		// Create new target test cases from canvas targets
		const targetTests: TestCase[] = canvasTargets.map((target, index) => ({
			id: `target-${target.x}-${target.y}`,
			description: {
				de: `Erreiche Ziel bei (${target.x}, ${target.y})`,
				en: `Reach target at (${target.x}, ${target.y})`
			},
			visible: true,
			type: 'target' as const,
			message: {
				de: `Ziel ${index + 1} erreicht!`,
				en: `Target ${index + 1} reached!`
			},
			expected: {
				target: {
					x: target.x,
					y: target.y,
					tolerance: target.tolerance ?? tolerance
				}
			}
		}));

		exercise.config.grader.testCases = [...nonTargetTests, ...targetTests];
	}

	/**
	 * Sync canvas path overlay to test case.
	 * Clears all existing 'path' type test cases and creates one from canvas path.
	 */
	function syncPathToTest() {
		const pathPoints = exercise.config.canvas.pathOverlay;

		// Remove all existing path-type test cases
		const nonPathTests = exercise.config.grader.testCases.filter((t) => t.type !== 'path');

		// If there's a path, create a path test case
		if (pathPoints.length > 1) {
			const pathTest: TestCase = {
				id: 'path-follow',
				description: {
					de: `Folge dem gezeichneten Pfad (${pathPoints.length} Punkte)`,
					en: `Follow the drawn path (${pathPoints.length} points)`
				},
				visible: true,
				type: 'path' as const,
				message: {
					de: 'Pfad erfolgreich verfolgt!',
					en: 'Path followed successfully!'
				},
				expected: {
					path: pathPoints.map((p) => ({ x: p.x, y: p.y }))
				}
			};

			exercise.config.grader.testCases = [...nonPathTests, pathTest];
		} else {
			exercise.config.grader.testCases = nonPathTests;
		}
	}

	// Watch visual targets and sync to tests
	watch(
		() => (isRobot ? exercise.config.grid.targets : exercise.config.canvas.targets),
		() => {
			syncTargetsToTests();
		}
	);

	// Watch canvas path and sync to tests
	watch(
		() => exercise.config.canvas.pathOverlay,
		() => {
			syncPathToTest();
		}
	);
	// ---------------------------------------------------
	// ---------------------------------------------------

	async function saveExercise() {
		if (exercise.published) {
			const result = runValidation();
			validationResult = result;
			if (!result.valid) {
				return;
			}
		} else {
			validationResult = null;
		}

		if (isNew) {
			try {
				const result = await createExercise({
					type: exercise.type,
					content: exercise.content,
					config: exercise.config,
					courseId: exercise.courseId,
					published: exercise.published
				}).updates(remote);
				handleServerResult(result, i18n.toast_exercise_created, i18n.toast_exercise_create_failed);
				if (result.success) {
					onSave?.();
				}
			} catch (error) {
				console.error(error);
				handleServerResult(
					{ success: false, error: i18n.toast_generic_error },
					'',
					i18n.toast_exercise_create_error
				);
			}
		} else {
			try {
				if (!exercise.id) {
					handleServerResult(
						{ success: false, error: i18n.toast_exercise_missing_id },
						'',
						i18n.toast_exercise_missing_id_hint
					);
					return;
				}

				const result = await updateExercise({
					id: exercise.id,
					type: exercise.type,
					content: exercise.content,
					config: exercise.config,
					courseId: exercise.courseId,
					published: exercise.published
				}).updates(remote);
				handleServerResult(result, i18n.toast_exercise_updated, i18n.toast_exercise_update_failed);
				if (result.success) {
					onSave?.();
				}
			} catch (error) {
				console.error(error);
				handleServerResult(
					{ success: false, error: i18n.toast_generic_error },
					'',
					i18n.toast_exercise_update_error
				);
			}
		}
	}

	function refreshPreview() {
		previewVersion += 1;
	}

	function handlePreviewSubmit() {
		// Preview uses the learner runtime locally and does not persist attempts.
	}

	async function handleRestoreVersion(versionId: string) {
		if (!exercise.id) return;

		restoringVersionId = versionId;

		try {
			const result = await restoreExerciseVersion({
				exerciseId: exercise.id,
				versionId
			});

			handleServerResult(
				result,
				i18n.toast_exercise_version_restored,
				i18n.toast_exercise_version_restore_failed
			);

			if (result.success) {
				await remote?.refresh?.();
				await versionHistory?.refresh?.();
				await refreshEditorExercise();
			}
		} catch (error) {
			console.error(error);
			handleServerResult(
				{
					success: false,
					error: i18n.toast_exercise_version_restore_failed
				},
				'',
				i18n.toast_exercise_version_restore_failed
			);
		} finally {
			restoringVersionId = null;
		}
	}

	function requestRestoreVersion(versionId: string) {
		pendingRestoreVersionId = versionId;
		restoreVersionConfirmOpen = true;
	}

	function confirmRestoreVersion() {
		const versionId = pendingRestoreVersionId;
		pendingRestoreVersionId = null;
		if (versionId) {
			void handleRestoreVersion(versionId);
		}
	}

	function clearRestoreVersionConfirmation() {
		pendingRestoreVersionId = null;
	}

	let imagePreview = $derived(exercise.content.image ?? '');
	async function handleImage(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		// Validate file type
		if (!file.type.startsWith('image/')) {
			showError(i18n.cms_image_invalid_type);
			return;
		}

		// Validate file size (e.g., max 5MB)
		const maxSize = 5 * 1024 * 1024; // 5MB
		if (file.size > maxSize) {
			showError(i18n.cms_image_invalid_size);
			return;
		}

		// Convert to base64
		return new Promise<void>((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = (event) => {
				const base64String = event.target?.result as string;
				exercise.content.image = base64String;
				imagePreview = base64String; // For preview
				resolve();
			};

			reader.onerror = () => {
				reject(new Error(i18n.cms_image_read_failed));
			};

			reader.readAsDataURL(file);
		});
	}
</script>

<div class="mx-auto max-w-7xl p-4">
	<div class="card bg-base-200 p-4 shadow-xl">
		<header
			class="flex flex-col gap-4 border-b border-base-300 pb-4 lg:flex-row lg:items-start lg:justify-between"
		>
			<div class="flex items-start gap-3">
				<button
					class="btn btn-ghost btn-sm"
					onclick={() => onCancel()}
					aria-label={i18n.cms_exercise_back}
				>
					<MoveLeft size="28" />
				</button>
				<div>
					<h1 class="text-2xl font-bold">
						{isNew ? i18n.cms_exercise_create_title : i18n.cms_exercise_edit_title}
					</h1>
					<p class="mt-1 text-sm text-base-content/65">
						{i18n.cms_exercise_header_hint}
					</p>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-3">
				<label class="label cursor-pointer gap-2 rounded-lg border border-base-300 px-3 py-2">
					<input
						type="checkbox"
						class="toggle toggle-primary"
						checked={exercise.published}
						onchange={handlePublishToggle}
					/>
					<span class="label-text font-medium">{i18n.published}</span>
				</label>
				<button class="btn btn-primary" onclick={saveExercise}>
					{isNew ? i18n.cms_exercise_create_button : i18n.cms_exercise_save_button}
				</button>
			</div>
		</header>

		{#if !isNew && exercise.id && versionHistory}
			<section class="mt-4 rounded-2xl border border-base-300 bg-base-100 p-4">
				<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 class="flex items-center gap-2 text-lg font-semibold">
							<History class="h-5 w-5" />
							{i18n.cms_exercise_versions_title}
						</h2>
						<p class="text-sm text-base-content/65">
							{i18n.cms_exercise_versions_hint}
						</p>
					</div>
					<span class="badge badge-outline">{versionItems.length}</span>
				</div>

				{#if versionHistory.loading}
					<div class="mt-3 text-sm text-base-content/60">{i18n.cms_loading}</div>
				{:else if versionItems.length === 0}
					<div
						class="mt-3 rounded-xl border border-dashed border-base-300 p-4 text-sm text-base-content/65"
					>
						{i18n.cms_exercise_versions_empty}
					</div>
				{:else}
					<div class="mt-4 space-y-3">
						{#each versionItems as version (version.id)}
							<div
								class="flex flex-col gap-3 rounded-xl border border-base-300 p-3 lg:flex-row lg:items-center lg:justify-between"
							>
								<div class="space-y-1">
									<div class="flex flex-wrap items-center gap-2">
										<span class="font-medium">{version.message}</span>
										{#if version.published === true}
											<span class="badge badge-sm badge-success">{i18n.published}</span>
										{:else if version.published === false}
											<span class="badge badge-sm badge-warning">{i18n.draft}</span>
										{/if}
									</div>
									<div class="text-sm text-base-content/65">
										{new Date(version.createdAt).toLocaleString()}
										·
										{version.createdBy}
									</div>
									{#if getVersionTitle(version)}
										<div class="text-sm text-base-content/80">{getVersionTitle(version)}</div>
									{/if}
								</div>

								<button
									type="button"
									class="btn btn-outline btn-sm"
									onclick={() => requestRestoreVersion(version.id)}
									disabled={restoringVersionId === version.id}
								>
									<RotateCcw class="h-4 w-4" />
									{restoringVersionId === version.id ? i18n.cms_restoring : i18n.cms_restore}
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<nav class="mt-4 overflow-x-auto" aria-label={i18n.cms_exercise_sections_label}>
			<div class="tabs-boxed tabs inline-flex min-w-full gap-1 md:min-w-0">
				{#each sections as section (section.id)}
					<button
						class={['tab', activeSection === section.id && 'tab-active']}
						onclick={() => (activeSection = section.id)}
					>
						<section.icon size="20" />
						<span class="ml-2 whitespace-nowrap">{section.label}</span>
					</button>
				{/each}
			</div>
		</nav>
		{#if validationResult && !validationResult.valid}
			<div class="mb-4 rounded-lg border border-error bg-error/10 p-4">
				<h3 class="mb-2 font-semibold text-error">{i18n.cms_exercise_validation_title}</h3>
				<ul class="ml-4 list-disc space-y-1 text-sm">
					{#each validationResult.issues as issue (`${issue.code}-${issue.field}`)}
						<li
							class:text-error={issue.severity === 'error'}
							class:text-warning={issue.severity === 'warning'}
						>
							{issue.message}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if activeSection === 'basics'}
			<h2 class="font-bold">{i18n.cms_exercise_section_basics}</h2>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">{i18n.cms_image_upload}</legend>
				<input type="file" class="file-input" accept="image/*" onchange={handleImage} />
			</fieldset>
			{#if imagePreview}
				<button class="btn w-fit btn-sm btn-primary" onclick={() => (exercise.content.image = '')}>
					{i18n.cms_image_remove}
				</button>
			{/if}
			{#if imagePreview}
				<img src={imagePreview} alt={i18n.player_exercise_image_alt} class="mt-2" />
			{/if}

			<div class="mt-4">
				<LocalizedInput bind:value={exercise.content.title} label={i18n.cms_field_title} />
			</div>
			<div class="mt-4">
				<LocalizedRichText
					bind:value={exercise.content.description}
					label={i18n.cms_field_description}
				/>
			</div>
			<div class="divider"></div>
			<TypeModeSelector bind:type={exercise.type} bind:mode={exercise.config.mode} />
			<div class="divider"></div>
		{/if}

		{#if activeSection === 'blocks'}
			<div class="space-y-4">
				<div>
					<h2 class="font-bold">{i18n.cms_blocks_title}</h2>
					<p class="text-sm text-base-content/60">
						{i18n.cms_blocks_hint}
					</p>
				</div>

				<div class="grid gap-3 lg:grid-cols-2">
					<div class="rounded-xl border border-base-300 bg-base-100 p-4">
						<div class="text-sm font-medium">{i18n.cms_blocks_status}</div>
						<div class="mt-1 text-sm text-base-content/70">
							{selectedBlockCount}
							{i18n.cms_blockpicker_selected}
						</div>
					</div>

					<div class="rounded-xl border border-base-300 bg-base-100 p-4">
						<div class="text-sm font-medium">{i18n.cms_starter_title}</div>
						<div class="mt-1 text-sm text-base-content/70">
							{#if exercise.config.hasStarterBlocks}
								{i18n.cms_starter_enabled_hint}
							{:else}
								{i18n.cms_starter_disabled_hint}
							{/if}
						</div>
					</div>
				</div>

				<BlockPicker bind:selectedBlocks={exercise.config.toolbox} exerciseType={exercise.type} />

				<div class="divider"></div>

				<section class="space-y-3">
					<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<div>
							<h2 class="font-bold">{i18n.cms_starter_title}</h2>
							<p class="text-sm text-base-content/60">
								{i18n.cms_starter_hint}
							</p>
						</div>

						<label
							class="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300 bg-base-100 px-3 py-2"
						>
							<input
								type="checkbox"
								class="checkbox checkbox-primary"
								checked={exercise.config.hasStarterBlocks}
								onchange={(event) => toggleStarterBlocks(event.currentTarget.checked)}
							/>
							<span class="label-text font-medium">{i18n.cms_starter_toggle}</span>
						</label>
					</div>

					{#if exercise.config.hasStarterBlocks}
						<div class="rounded-xl border border-base-300 bg-base-100 p-4">
							<div class="mb-3 rounded-lg bg-base-200 p-3 text-sm text-base-content/70">
								{i18n.cms_starter_builder_hint}
							</div>

							{#key starterWorkspaceKey}
								<BlocklyWorkspace
									bind:this={blocklyRef}
									toolboxConfig={getToolbox()}
									starterXml={exercise.config.starterXml}
									ariaLabel={i18n.cms_starter_title}
								/>
							{/key}

							<div class="mt-3 flex flex-wrap gap-2">
								<button type="button" class="btn btn-sm btn-primary" onclick={captureStarterXml}>
									{i18n.cms_starter_save}
								</button>
								<button type="button" class="btn btn-ghost btn-sm" onclick={resetStarterWorkspace}>
									{i18n.cms_starter_reset}
								</button>
								<button
									type="button"
									class="btn btn-ghost btn-sm"
									onclick={() => blocklyRef?.clear()}
								>
									{i18n.cms_starter_empty}
								</button>
								<button type="button" class="btn btn-outline btn-sm" onclick={clearStarterXml}>
									{i18n.cms_starter_turn_off}
								</button>
							</div>
						</div>
					{:else}
						<div
							class="rounded-xl border border-dashed border-base-300 bg-base-100 p-6 text-center"
						>
							<h3 class="text-base font-semibold">{i18n.cms_starter_empty_title}</h3>
							<p class="mt-2 text-sm text-base-content/65">
								{i18n.cms_starter_empty_hint}
							</p>
							<button
								type="button"
								class="btn mt-4 btn-sm btn-primary"
								onclick={() => toggleStarterBlocks(true)}
							>
								{i18n.cms_starter_enable}
							</button>
						</div>
					{/if}
				</section>
			</div>
		{/if}

		{#if activeSection === 'canvas'}
			{#if exercise.type === 'io'}
				<div class="space-y-4">
					<div>
						<h2 class="font-bold">{i18n.cms_exercise_section_io}</h2>
						<p class="mb-4 text-sm text-base-content/60">
							{i18n.cms_io_section_hint}
						</p>
					</div>

					<IoTestsEditor
						bind:tests={exercise.config.io.tests}
						bind:normalization={exercise.config.io.normalization}
						bind:visibleExampleInput={exercise.config.io.visibleExampleInput}
						bind:visibleExampleOutput={exercise.config.io.visibleExampleOutput}
					/>
				</div>
			{:else}
				<h2 class="font-bold">{isRobot ? i18n.cms_robot_grid_title : i18n.cms_canvas_title}</h2>
				<p class="mb-4 text-sm text-base-content/60">
					{isRobot ? i18n.cms_robot_grid_hint : i18n.cms_canvas_hint}
				</p>

				{#if isRobot}
					<section class="mb-4 rounded-xl border border-base-300 bg-base-100 p-4">
						<h3 class="font-semibold">{i18n.cms_robot_grid_settings}</h3>
						<div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							<label class="form-control">
								<span class="label-text">{i18n.cms_robot_grid_width}</span>
								<input
									type="number"
									class="input-bordered input input-sm"
									min="1"
									value={exercise.config.grid.width}
									oninput={(event) => updateRobotGridDimension('width', event)}
								/>
							</label>
							<label class="form-control">
								<span class="label-text">{i18n.cms_robot_grid_height}</span>
								<input
									type="number"
									class="input-bordered input input-sm"
									min="1"
									value={exercise.config.grid.height}
									oninput={(event) => updateRobotGridDimension('height', event)}
								/>
							</label>
							<label class="form-control">
								<span class="label-text">{i18n.cms_robot_grid_cell_size}</span>
								<input
									type="number"
									class="input-bordered input input-sm"
									min="1"
									value={exercise.config.grid.cellSize}
									oninput={updateRobotGridCellSize}
								/>
							</label>
							<label class="form-control">
								<span class="label-text">{i18n.cms_robot_grid_start_x}</span>
								<input
									type="number"
									class="input-bordered input input-sm"
									min="0"
									value={exercise.config.grid.start.x}
									oninput={(event) => updateRobotGridStart('x', event)}
								/>
							</label>
							<label class="form-control">
								<span class="label-text">{i18n.cms_robot_grid_start_y}</span>
								<input
									type="number"
									class="input-bordered input input-sm"
									min="0"
									value={exercise.config.grid.start.y}
									oninput={(event) => updateRobotGridStart('y', event)}
								/>
							</label>
							<label class="form-control">
								<span class="label-text">{i18n.cms_robot_grid_direction}</span>
								<select
									class="select-bordered select select-sm"
									value={exercise.config.grid.direction}
									onchange={updateRobotGridDirection}
								>
									<option value="north">{i18n.cms_robot_direction_north}</option>
									<option value="east">{i18n.cms_robot_direction_east}</option>
									<option value="south">{i18n.cms_robot_direction_south}</option>
									<option value="west">{i18n.cms_robot_direction_west}</option>
								</select>
							</label>
						</div>
					</section>
				{/if}

				<div class="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-base-300 p-2">
					<button
						type="button"
						class="btn gap-1 btn-sm"
						class:btn-primary={showGrid}
						onclick={() => (showGrid = !showGrid)}
					>
						<Grid3X3 size="16" />
						{showGrid ? i18n.cms_canvas_hide_grid : i18n.cms_canvas_show_grid}
					</button>

					<div class="divider mx-1 divider-horizontal"></div>

					<button
						type="button"
						class="btn gap-1 btn-sm"
						class:btn-primary={drawMode === 'path'}
						onclick={() => (drawMode = drawMode === 'path' ? null : 'path')}
					>
						<Brush size="16" />
						{i18n.cms_canvas_path}
						{#if pathPointCount > 0}
							<span class="badge badge-xs badge-success">{pathPointCount}</span>
						{/if}
					</button>
					<button
						type="button"
						class="btn gap-1 btn-sm"
						class:btn-error={drawMode === 'target'}
						onclick={() => (drawMode = drawMode === 'target' ? null : 'target')}
					>
						<Apple size="16" />
						{i18n.cms_canvas_target}
						{#if targetCount > 0}
							<span class="badge badge-xs badge-success">{targetCount}</span>
						{/if}
					</button>
					<button
						type="button"
						class="btn gap-1 btn-sm"
						class:btn-neutral={drawMode === 'wall'}
						onclick={() => (drawMode = drawMode === 'wall' ? null : 'wall')}
					>
						<BrickWall size="16" />
						{i18n.cms_canvas_wall}
						{#if walls.length > 0}
							<span class="badge badge-xs">{walls.length}</span>
						{/if}
					</button>

					<div class="flex-1"></div>

					<button type="button" class="btn gap-1 btn-ghost btn-sm" onclick={clearCanvas}>
						<Trash size="16" />
						{i18n.cms_canvas_clear}
					</button>
				</div>

				{#if drawMode}
					<div class="mb-4 alert py-2 alert-info">
						<span class="text-sm">
							{#if drawMode === 'path'}
								<Brush class="mr-1 inline h-4 w-4" />
								{i18n.cms_canvas_path_hint}
							{:else if drawMode === 'target'}
								<Apple class="mr-1 inline h-4 w-4" />
								{i18n.cms_canvas_target_hint}
							{:else if drawMode === 'wall'}
								<BrickWall class="mr-1 inline h-4 w-4" />
								{i18n.cms_canvas_wall_hint}
							{/if}
						</span>
					</div>
				{/if}

				<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
					<div class="lg:col-span-2">
						<div class="flex justify-center rounded-lg border border-base-300 bg-base-100 p-4">
							<Canvas
								engine={getEngine()!}
								actorType={exercise.type === 'turtle' ? 'turtle' : 'robot'}
								editable={true}
								{showGrid}
								gridSize={canvasGridSize}
								{drawMode}
								{pathOverlay}
								{targets}
								{walls}
								onPathChange={updatePath}
								onTargetChange={updateTargets}
								onWallsChange={updateWalls}
							/>
						</div>
					</div>

					<div class="lg:col-span-1">
						<AutoTestsPanel
							{pathOverlay}
							testCases={exercise.config.grader.testCases}
							appleTolerance={exercise.config.grader.appleTolerance}
							wallTolerance={exercise.config.grader.wallTolerance}
							onAppleToleranceChange={(v) => (exercise.config.grader.appleTolerance = v)}
							onWallToleranceChange={(v) => (exercise.config.grader.wallTolerance = v)}
						/>
					</div>
				</div>

				<div class="mt-6">
					<button
						type="button"
						class="flex w-full items-center gap-2 rounded-lg bg-base-300 px-4 py-3 text-left hover:bg-base-200"
						onclick={() => (showManualTests = !showManualTests)}
					>
						{#if showManualTests}
							<ChevronDown size="20" />
						{:else}
							<ChevronRight size="20" />
						{/if}
						<span class="font-medium">{i18n.cms_manual_tests_title}</span>
						<span class="text-sm text-base-content/60">({i18n.cms_manual_tests_hint})</span>
					</button>

					{#if showManualTests}
						<div class="mt-2 rounded-lg border border-base-300 p-4">
							<TestCaseEditor
								bind:testCases={exercise.config.grader.testCases}
								exerciseType={exercise.type}
							/>
						</div>
					{/if}
				</div>
			{/if}
		{/if}

		{#if activeSection === 'hints'}
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">{i18n.cms_hints_title}</h2>

					<HintEditor bind:hints={exercise.config.hints} />
				</div>
			</div>
		{/if}

		{#if activeSection === 'preview'}
			<div class="space-y-4">
				<div
					class="flex flex-col gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 lg:flex-row lg:items-center lg:justify-between"
				>
					<div>
						<h2 class="text-lg font-semibold">{i18n.cms_preview_title}</h2>
						<p class="mt-1 text-sm text-base-content/65">
							{i18n.cms_preview_hint}
						</p>
					</div>

					<div class="flex flex-wrap gap-2">
						<button type="button" class="btn btn-outline btn-sm" onclick={refreshPreview}>
							{i18n.cms_preview_refresh}
						</button>
						<button
							type="button"
							class="btn btn-sm btn-primary"
							onclick={() => (activeSection = 'basics')}
						>
							{i18n.cms_preview_edit}
						</button>
					</div>
				</div>

				{#if validationResult && !validationResult.valid}
					<div
						class="rounded-xl border border-warning bg-warning/10 p-4 text-sm text-warning-content"
					>
						{i18n.cms_preview_publish_note}
					</div>
				{/if}

				<div class="rounded-2xl border border-base-300 bg-base-100 p-3">
					{#key `${previewExercise.id}-${previewVersion}`}
						<ExercisePlayer
							exercise={previewExercise}
							currentIndex={0}
							totalExercises={1}
							onSubmit={handlePreviewSubmit}
							onNext={() => {}}
							hasNextExercise={false}
							initialWorkspaceXml={previewExercise.hasStarterBlocks
								? previewExercise.starterXml
								: ''}
						/>
					{/key}
				</div>
			</div>
		{/if}
	</div>
</div>

<ConfirmModal
	bind:open={restoreVersionConfirmOpen}
	message={i18n.confirm_restore_version}
	confirmLabel={i18n.cms_restore}
	onConfirm={confirmRestoreVersion}
	onCancel={clearRestoreVersionConfirmation}
/>
