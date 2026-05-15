import { getContext, setContext } from 'svelte';
import { Blocks, Eye, FlaskConical, Info, Lightbulb, Palette } from '@lucide/svelte';
import {
	canonicalizeExercise,
	createDefaultExerciseFormData,
	validateExercise,
	type Exercise,
	type ExerciseFormData,
	type PublishValidationResult
} from '$lib/types/exercise';
import type { DrawMode, Point, TargetPoint } from '$lib/canvas/types';
import type { BlocklyCategoryConfig, BlocklyToolboxConfig } from '$lib/blockly/types';
import { BlocklyToolboxKind } from '$lib/blockly/types';
import { Turtle } from '$lib/canvas/Turtle.svelte';
import { Robot } from '$lib/canvas/Robot.svelte';
import { getCategoryForBlocks } from '$lib/blockly/BlocklyFactory';
import {
	LOGIC_BLOCKS,
	LOOP_BLOCKS,
	MATH_BLOCKS,
	TEXT_BLOCKS
} from '$lib/blockly/presets';
import {
	createExercise,
	getExercise,
	getExerciseVersions,
	restoreExerciseVersion,
	updateExercise
} from '$lib/remote/exercises.remote';
import { i18n } from '$lib/i18n/index.svelte';
import { rebuildPathTest, rebuildTargetTests } from './canvas-sync';
import { handleServerResult, showError } from '$lib/utils/toast';

export type SectionId = 'basics' | 'blocks' | 'canvas' | 'hints' | 'preview';

export type ExerciseVersionItem = {
	id: string;
	message: string;
	createdBy: string;
	createdAt: number;
	type: string | null;
	published: boolean | null;
	title: unknown;
};

type Options = {
	exercise?: ExerciseFormData;
	remote?: any;
	onSave?: () => void;
	isNew?: boolean;
};

/**
 * Authoring state and behavior for the Exercise editor. Owns the form data,
 * UI flags, validation, save, and version-restore flow. DOM-bound work
 * (Blockly workspace ref, Canvas component ref, keyboard handler) stays in
 * the `.svelte` component.
 */
export class ExerciseEditorState {
	exercise: ExerciseFormData = createDefaultExerciseFormData();
	isNew = true;
	private remote: any = null;
	private onSave?: () => void;

	// --- UI ---
	activeSection = $state<SectionId>('basics');
	showGrid = $state(true);
	drawMode = $state<DrawMode>(null);
	canvasSelected = $state<unknown>(null);
	showManualTests = $state(false);

	// --- Cache-busting version stamps for keyed re-renders ---
	toolboxVersion = $state(0);
	starterWorkspaceVersion = $state(0);
	previewVersion = $state(0);

	// --- Validation & publish ---
	validationResult = $state<PublishValidationResult | null>(null);

	// --- Version history / restore ---
	restoringVersionId = $state<string | null>(null);
	pendingRestoreVersionId = $state<string | null>(null);
	restoreVersionConfirmOpen = $state(false);

	// --- Preview ---
	previewExercise = $state<Exercise>(undefined as unknown as Exercise);

	// --- Image preview (mirrors content.image so the file input can show a fresh blob) ---
	imagePreview = $state('');

	// --- Derived ---
	isRobot = $derived(this.exercise.type === 'robot');
	pathOverlay = $derived(this.exercise.config.canvas.pathOverlay);
	targets = $derived<TargetPoint[]>(
		this.isRobot
			? this.exercise.config.grid.targets.map((target) => ({ ...target }))
			: this.exercise.config.canvas.targets
	);
	walls = $derived(
		this.isRobot ? this.exercise.config.grid.walls : this.exercise.config.canvas.walls
	);
	canvasStart = $derived(this.isRobot ? null : this.exercise.config.canvas.start);
	canvasFinish = $derived(this.isRobot ? null : this.exercise.config.canvas.finish);
	canvasGridSize = $derived(
		this.isRobot ? this.exercise.config.grid.cellSize : this.exercise.config.canvas.gridSize
	);
	targetCount = $derived(this.targets.length);
	pathPointCount = $derived(this.pathOverlay.length);
	selectedBlockCount = $derived(this.exercise.config.toolbox.length);
	starterWorkspaceKey = $derived(
		`starter-${this.toolboxVersion}-${this.starterWorkspaceVersion}`
	);

	sections = $derived([
		{ id: 'basics' as const, label: i18n.cms_exercise_section_basics, icon: Info },
		{ id: 'blocks' as const, label: i18n.cms_exercise_section_blocks, icon: Blocks },
		{
			id: 'canvas' as const,
			label:
				this.exercise.type === 'io'
					? i18n.cms_exercise_section_io
					: this.isRobot
						? i18n.cms_exercise_section_grid
						: i18n.cms_exercise_section_canvas,
			icon: this.exercise.type === 'io' ? FlaskConical : Palette
		},
		{ id: 'hints' as const, label: i18n.cms_exercise_section_hints, icon: Lightbulb },
		{ id: 'preview' as const, label: i18n.cms_exercise_section_preview, icon: Eye }
	]);

	versionHistory = $derived(
		this.exercise.id ? getExerciseVersions({ exerciseId: this.exercise.id }) : null
	);

	constructor(options: Options = {}) {
		this.exercise = options.exercise ?? createDefaultExerciseFormData();
		this.isNew = options.isNew ?? true;
		this.remote = options.remote;
		this.onSave = options.onSave;
		this.previewExercise = this.buildPreviewExercise();
		this.imagePreview = this.exercise.content.image ?? '';
	}

	// =========================================================================
	// Validation & publish
	// =========================================================================

	runValidation(): PublishValidationResult {
		const hydrated = canonicalizeExercise({
			id: this.exercise.id ?? 'validation-check',
			courseId: this.exercise.courseId,
			type: this.exercise.type,
			content: this.exercise.content,
			config: this.exercise.config,
			published: this.exercise.published,
			order: this.exercise.order
		});
		return validateExercise(hydrated);
	}

	handlePublishToggle(checked: boolean) {
		if (checked) {
			const result = this.runValidation();
			this.validationResult = result;
			if (!result.valid) {
				this.exercise.published = false;
				return;
			}
		}
		this.exercise.published = checked;
		if (!checked) this.validationResult = null;
	}

	// =========================================================================
	// Canvas updates
	// =========================================================================

	updatePath = (points: Point[]) => {
		this.exercise.config.canvas.pathOverlay = points;
	};

	updateTargets = (next: TargetPoint[]) => {
		if (this.isRobot) {
			this.exercise.config.grid.targets = next.map(({ x, y }) => ({ x, y }));
		} else {
			this.exercise.config.canvas.targets = next;
		}
	};

	updateWalls = (next: Point[]) => {
		if (this.isRobot) {
			this.exercise.config.grid.walls = next;
		} else {
			this.exercise.config.canvas.walls = next;
		}
	};

	updateStart = (point: Point | null) => {
		if (!this.isRobot) this.exercise.config.canvas.start = point;
	};

	updateFinish = (point: Point | null) => {
		if (!this.isRobot) this.exercise.config.canvas.finish = point;
	};

	clearCanvas = () => {
		this.exercise.config.canvas.pathOverlay = [];
		if (this.isRobot) {
			this.exercise.config.grid.targets = [];
			this.exercise.config.grid.walls = [];
		} else {
			this.exercise.config.canvas.targets = [];
			this.exercise.config.canvas.walls = [];
		}
	};

	syncTargetsToTests() {
		this.exercise.config.grader.testCases = rebuildTargetTests(
			this.exercise.config.grader.testCases,
			this.targets,
			this.exercise.config.grader.appleTolerance ?? 10
		);
	}

	syncPathToTest() {
		this.exercise.config.grader.testCases = rebuildPathTest(
			this.exercise.config.grader.testCases,
			this.exercise.config.canvas.pathOverlay
		);
	}

	// =========================================================================
	// Blockly toolbox (for the starter-blocks editor preview)
	// =========================================================================

	getEngine() {
		if (this.exercise.type === 'io') return null;
		if (this.exercise.type === 'turtle') return new Turtle(400, 400);
		const { width, height, cellSize, start, direction } = this.exercise.config.grid;
		const engine = new Robot(width * cellSize, height * cellSize, { start, direction });
		engine.gridSize = cellSize;
		return engine;
	}

	private buildBuiltinCategories(): BlocklyCategoryConfig[] {
		const make = (name: string, colour: number, ids: string[]): BlocklyCategoryConfig => ({
			kind: 'category',
			name,
			colour,
			contents: ids
				.filter((id) => this.exercise.config.toolbox.includes(id))
				.map((id) => ({ kind: 'block', type: id }))
		});

		const out: BlocklyCategoryConfig[] = [];
		for (const [label, colour, ids] of [
			[i18n.toolbox_logic, 210, LOGIC_BLOCKS],
			[i18n.toolbox_loops, 120, LOOP_BLOCKS],
			[i18n.toolbox_math, 230, MATH_BLOCKS],
			[i18n.toolbox_text, 160, TEXT_BLOCKS]
		] as const) {
			const category = make(label, colour, ids as unknown as string[]);
			if (category.contents.length) out.push(category);
		}
		return out;
	}

	getToolbox(): BlocklyToolboxConfig {
		if (this.exercise.type === 'io') {
			return { kind: BlocklyToolboxKind.CATEGORY, contents: this.buildBuiltinCategories() };
		}
		const engine = this.getEngine();
		const engineBlocks =
			engine?.blockDefs.filter((b) => this.exercise.config.toolbox.includes(b.id)) ?? [];
		const engineCategory = getCategoryForBlocks(
			engineBlocks,
			this.exercise.type,
			this.exercise.type === 'turtle' ? i18n.toolbox_turtle : i18n.toolbox_robot,
			160
		);
		return {
			kind: BlocklyToolboxKind.CATEGORY,
			contents: [engineCategory, ...this.buildBuiltinCategories()].filter(Boolean)
		};
	}

	bumpToolboxVersion() {
		this.toolboxVersion += 1;
	}

	// =========================================================================
	// Starter blocks (DOM-bound bits live in the component; class handles state)
	// =========================================================================

	setStarterXml(xml: string) {
		this.exercise.config.starterXml = xml;
		this.exercise.config.hasStarterBlocks = true;
	}

	toggleStarterBlocks(enabled: boolean) {
		this.exercise.config.hasStarterBlocks = enabled;
		this.starterWorkspaceVersion += 1;
	}

	resetStarterWorkspace() {
		this.starterWorkspaceVersion += 1;
	}

	clearStarterXml() {
		this.exercise.config.starterXml = '';
		this.exercise.config.hasStarterBlocks = false;
		this.starterWorkspaceVersion += 1;
	}

	// =========================================================================
	// Preview
	// =========================================================================

	buildPreviewExercise(): Exercise {
		return canonicalizeExercise({
			id: this.exercise.id ?? 'preview-exercise',
			courseId: this.exercise.courseId,
			type: this.exercise.type,
			content: this.exercise.content,
			config: this.exercise.config,
			published: this.exercise.published,
			order: this.exercise.order
		});
	}

	refreshPreview = () => {
		this.previewExercise = this.buildPreviewExercise();
		this.previewVersion += 1;
	};

	private applyExercise(next: Exercise) {
		this.exercise.id = next.id;
		this.exercise.courseId = next.courseId;
		this.exercise.type = next.type;
		this.exercise.content = structuredClone(next.content);
		this.exercise.config = structuredClone(next.config);
		this.exercise.published = next.published;
		this.exercise.order = next.order;
		this.validationResult = next.validation;
		this.toolboxVersion += 1;
		this.starterWorkspaceVersion += 1;
		this.previewExercise = this.buildPreviewExercise();
		this.previewVersion += 1;
	}

	private async refreshEditorExercise() {
		if (!this.exercise.id) return;
		const latest = getExercise({ id: this.exercise.id });
		await latest.refresh();
		if (latest.current) this.applyExercise(latest.current as Exercise);
	}

	// =========================================================================
	// Save (create / update)
	// =========================================================================

	saveExercise = async () => {
		if (this.exercise.published) {
			const result = this.runValidation();
			this.validationResult = result;
			if (!result.valid) return;
		} else {
			this.validationResult = null;
		}

		try {
			if (this.isNew) {
				const result = await createExercise({
					type: this.exercise.type,
					content: this.exercise.content,
					config: this.exercise.config,
					courseId: this.exercise.courseId,
					published: this.exercise.published
				}).updates(this.remote);
				handleServerResult(result, i18n.toast_exercise_created, i18n.toast_exercise_create_failed);
				if (result.success) this.onSave?.();
				return;
			}

			if (!this.exercise.id) {
				handleServerResult(
					{ success: false, error: i18n.toast_exercise_missing_id },
					'',
					i18n.toast_exercise_missing_id_hint
				);
				return;
			}

			const result = await updateExercise({
				id: this.exercise.id,
				type: this.exercise.type,
				content: this.exercise.content,
				config: this.exercise.config,
				courseId: this.exercise.courseId,
				published: this.exercise.published
			}).updates(this.remote);
			handleServerResult(result, i18n.toast_exercise_updated, i18n.toast_exercise_update_failed);
			if (result.success) this.onSave?.();
		} catch (error) {
			console.error(error);
			handleServerResult(
				{ success: false, error: i18n.toast_generic_error },
				'',
				this.isNew ? i18n.toast_exercise_create_error : i18n.toast_exercise_update_error
			);
		}
	};

	// =========================================================================
	// Version history / restore
	// =========================================================================

	requestRestoreVersion = (versionId: string) => {
		this.pendingRestoreVersionId = versionId;
		this.restoreVersionConfirmOpen = true;
	};

	confirmRestoreVersion = () => {
		const versionId = this.pendingRestoreVersionId;
		this.pendingRestoreVersionId = null;
		if (versionId) void this.handleRestoreVersion(versionId);
	};

	clearRestoreVersionConfirmation = () => {
		this.pendingRestoreVersionId = null;
	};

	private async handleRestoreVersion(versionId: string) {
		if (!this.exercise.id) return;
		this.restoringVersionId = versionId;
		try {
			const result = await restoreExerciseVersion({
				exerciseId: this.exercise.id,
				versionId
			});
			handleServerResult(
				result,
				i18n.toast_exercise_version_restored,
				i18n.toast_exercise_version_restore_failed
			);
			if (result.success) {
				await this.remote?.refresh?.();
				await this.versionHistory?.refresh?.();
				await this.refreshEditorExercise();
			}
		} catch (error) {
			console.error(error);
			handleServerResult(
				{ success: false, error: i18n.toast_exercise_version_restore_failed },
				'',
				i18n.toast_exercise_version_restore_failed
			);
		} finally {
			this.restoringVersionId = null;
		}
	}

	// =========================================================================
	// Image handling
	// =========================================================================

	handleImageFile = async (file: File | undefined) => {
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			showError(i18n.cms_image_invalid_type);
			return;
		}
		const maxSize = 5 * 1024 * 1024;
		if (file.size > maxSize) {
			showError(i18n.cms_image_invalid_size);
			return;
		}
		await new Promise<void>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (event) => {
				const data = event.target?.result as string;
				this.exercise.content.image = data;
				this.imagePreview = data;
				resolve();
			};
			reader.onerror = () => reject(new Error(i18n.cms_image_read_failed));
			reader.readAsDataURL(file);
		});
	};

	clearImage = () => {
		this.exercise.content.image = '';
		this.imagePreview = '';
	};
}

const EXERCISE_EDITOR_KEY = Symbol('exercise-editor');

export const setExerciseEditor = (state: ExerciseEditorState) =>
	setContext(EXERCISE_EDITOR_KEY, state);

export const getExerciseEditor = () =>
	getContext<ExerciseEditorState>(EXERCISE_EDITOR_KEY);
