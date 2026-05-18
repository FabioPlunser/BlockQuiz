<script lang="ts">
	import { untrack } from 'svelte';
	import { watch } from 'runed';
	import { ChevronDown, ChevronRight, MoveLeft } from '@lucide/svelte';
	import { i18n } from '$lib/i18n/index.svelte';
	import type { ExerciseFormData } from '$types/exercise';

	import LocalizedRichText from '$cp/editor/LocalizedRichText.svelte';
	import LocalizedInput from '$cp/editor/LocalizedInput.svelte';
	import TypeModeSelector from '$cp/editor/TypeModeSelector.svelte';
	import BlockPicker from '$cp/editor/BlockPicker.svelte';
	import BlocklyWorkspace from '$cp/BlocklyWorkspace.svelte';
	import Canvas from '$cp/Canvas.svelte';
	import TestCaseEditor from '$cp/editor/TestCaseEditor.svelte';
	import HintEditor from '$cp/editor/HintEditor.svelte';
	import AutoTestsPanel from '$cp/editor/AutoTestsPanel.svelte';
	import IoTestsEditor from '$cp/editor/IoTestsEditor.svelte';
	import ConfirmModal from '$cp/ConfirmModal.svelte';
	import SearchableDropdown from '$cp/SearchableDropdown.svelte';
	import { getAssignableAuthors } from '$lib/remote/users.remote';
	import { setExerciseAuthor } from '$lib/remote/exercises.remote';
	import { showError } from '$lib/utils/toast';

	import VersionHistoryPanel from './exercise-editor/VersionHistoryPanel.svelte';
	import PreviewSection from './exercise-editor/PreviewSection.svelte';
	import RobotGridSettings from './exercise-editor/RobotGridSettings.svelte';
	import CanvasToolbar from './exercise-editor/CanvasToolbar.svelte';
	import {
		ExerciseEditorState,
		setExerciseEditor
	} from './exercise-editor/ExerciseEditorState.svelte';

	type Props = {
		exercise?: ExerciseFormData;
		remote?: any;
		onSave?: () => void;
		onCancel: () => void;
		isNew?: boolean;
	};

	let { exercise = $bindable(), remote, onSave, onCancel, isNew = true }: Props = $props();

	const editor = untrack(() => new ExerciseEditorState({ exercise, remote, onSave, isNew }));
	setExerciseEditor(editor);

	let blocklyRef = $state<BlocklyWorkspace | undefined>(undefined);
	let canvasRef = $state<ReturnType<typeof Canvas> | undefined>(undefined);

	// Re-key the starter blockly workspace when toolbox or workspace version bumps.
	let versionData = $derived(editor.versionHistory ? editor.versionHistory : null);
	let versionItems = $derived((versionData?.current ?? []) as any[]);

	watch(
		() => editor.exercise.config.toolbox,
		() => editor.bumpToolboxVersion()
	);

	watch(
		() =>
			editor.isRobot ? editor.exercise.config.grid.targets : editor.exercise.config.canvas.targets,
		() => editor.syncTargetsToTests()
	);

	watch(
		() => editor.exercise.config.canvas.pathOverlay,
		() => editor.syncPathToTest()
	);

	function captureStarterXml() {
		if (!blocklyRef) return;
		editor.setStarterXml(blocklyRef.getXml());
	}

	function clearStarterWorkspace() {
		blocklyRef?.clear();
	}

	function clearStarterXml() {
		editor.clearStarterXml();
		blocklyRef?.clear();
	}

	function handleImageInput(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		void editor.handleImageFile(file);
	}

	const authors = getAssignableAuthors();
	type AssignableAuthor = { id: string; name: string | null; email: string; role: string };
	let authorList = $derived((authors.current ?? []) as AssignableAuthor[]);
	let authorOptions = $derived(
		authorList.map((a) => ({ value: a.id, label: a.email ?? a.name ?? a.id }))
	);
	// exercises.created_by stores the user.id directly (FK).
	let currentAuthorId = $derived(editor.exercise.id ? (editor.exercise.createdBy ?? '') : '');
	// Staged author selection — persisted only when the user clicks Save.
	let pendingAuthorId = $state<string>('');
	$effect(() => {
		pendingAuthorId = currentAuthorId;
	});

	function handleSelectAuthor(newAuthorId: string) {
		pendingAuthorId = newAuthorId;
	}

	// Hand the editor state a hook so its existing Save flow can flush the
	// author change in the same round-trip and stay on this page.
	editor.persistAuthorChange = async () => {
		if (!editor.exercise.id) return;
		if (!pendingAuthorId || pendingAuthorId === currentAuthorId) return;
		const result = await setExerciseAuthor({
			exerciseId: editor.exercise.id,
			userId: pendingAuthorId
		});
		if (!result.success) {
			showError(result.error ?? i18n.toast_generic_error);
		}
	};
</script>

<svelte:window
	onkeydown={(e) => {
		if (
			editor.drawMode === 'select' &&
			editor.canvasSelected &&
			editor.activeSection === 'canvas' &&
			(e.key === 'Delete' || e.key === 'Backspace')
		) {
			const target = e.target as HTMLElement | null;
			const tag = target?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
			e.preventDefault();
			canvasRef?.deleteSelected();
		}
	}}
/>

<div class="h-[calc(100dvh-9rem)] p-4">
	<div class="card flex h-full flex-col bg-base-200 p-4 shadow-xl">
		<header
			class="flex shrink-0 flex-col gap-4 border-b border-base-300 pb-4 lg:flex-row lg:items-start lg:justify-between"
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
						{editor.isNew ? i18n.cms_exercise_create_title : i18n.cms_exercise_edit_title}
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
						checked={editor.exercise.published}
						onchange={(e) => editor.handlePublishToggle((e.target as HTMLInputElement).checked)}
					/>
					<span class="label-text font-medium">{i18n.published}</span>
				</label>
				<button class="btn btn-primary" onclick={editor.saveExercise}>
					{editor.isNew ? i18n.cms_exercise_create_button : i18n.cms_exercise_save_button}
				</button>
			</div>
		</header>

		<div class="mt-4 grid min-h-0 flex-1 gap-6 overflow-hidden lg:grid-cols-[14rem_minmax(0,1fr)]">
			<aside class="min-h-0 overflow-y-auto pr-1 lg:self-stretch">
				<nav aria-label={i18n.cms_exercise_sections_label}>
					<ol
						class="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
					>
						{#each editor.sections as section, i (section.id)}
							{@const status = editor.sectionStatus(section.id)}
							{@const isActive = editor.activeSection === section.id}
							<li class="shrink-0 lg:shrink">
								<button
									type="button"
									class={[
										'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
										isActive
											? 'bg-primary/15 ring-1 ring-primary/30'
											: 'text-base-content/80 hover:bg-base-300/60'
									]}
									onclick={() => (editor.activeSection = section.id)}
									aria-current={isActive ? 'step' : undefined}
								>
									<span
										class={[
											'grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums',
											isActive && 'bg-primary text-primary-content',
											!isActive && status === 'done' && 'bg-success/20 text-success-content',
											!isActive && status === 'issue' && 'bg-warning text-warning-content',
											!isActive && status === 'todo' && 'bg-base-300 text-base-content/65'
										]}
									>
										{#if status === 'done'}
											✓
										{:else if status === 'issue'}
											!
										{:else}
											{i + 1}
										{/if}
									</span>
									<span class="flex min-w-0 flex-col">
										<span class="flex items-center gap-2 truncate text-sm font-medium">
											<section.icon size="16" />
											{section.label}
										</span>
										{#if status === 'issue'}
											<span class="text-xs text-warning">
												{i18n.cms_section_needs_attention ?? 'needs attention'}
											</span>
										{/if}
									</span>
								</button>
							</li>
						{/each}
					</ol>
				</nav>
			</aside>

			<div class="min-h-0 min-w-0 overflow-y-auto pr-2">
				{#if editor.validationResult && !editor.validationResult.valid}
					<div class="mb-4 overflow-hidden rounded-2xl border border-warning/40 bg-warning/10">
						<div class="flex items-center gap-3 border-b border-warning/30 bg-warning/15 px-4 py-3">
							<span
								class="grid h-9 w-9 place-items-center rounded-full bg-warning text-warning-content"
								aria-hidden="true"
							>
								!
							</span>
							<div class="min-w-0">
								<div class="text-base font-semibold">
									{i18n.cms_publish_checklist_title ?? 'Before you publish'}
								</div>
								<div class="text-xs text-base-content/65">
									{i18n.cms_publish_checklist_hint ??
										'These items still need attention before this exercise can be published.'}
								</div>
							</div>
						</div>
						<ul class="divide-y divide-warning/20">
							{#each editor.validationResult.issues as issue (`${issue.code}-${issue.field}`)}
								<li class="flex items-start gap-3 px-4 py-3">
									<span
										class={[
											'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold',
											issue.severity === 'error'
												? 'bg-error/15 text-error'
												: 'bg-warning/25 text-warning-content'
										]}
									>
										{issue.severity === 'error' ? '!' : '?'}
									</span>
									<div class="min-w-0 flex-1 text-sm">{issue.message}</div>
									<button
										type="button"
										class="btn btn-ghost btn-xs"
										onclick={() => (editor.activeSection = editor.sectionForField(issue.field))}
									>
										{i18n.cms_fix_in_section ?? 'Jump'} →
									</button>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if editor.activeSection === 'basics'}
					<h2 class="font-bold">{i18n.cms_exercise_section_basics}</h2>
					<fieldset class="fieldset">
						<legend class="fieldset-legend">{i18n.cms_image_upload}</legend>
						<input type="file" class="file-input" accept="image/*" onchange={handleImageInput} />
					</fieldset>
					{#if editor.imagePreview}
						<button class="btn w-fit btn-sm btn-primary" onclick={editor.clearImage}>
							{i18n.cms_image_remove}
						</button>
						<img src={editor.imagePreview} alt={i18n.player_exercise_image_alt} class="mt-2" />
					{/if}

					<div class="mt-4">
						<LocalizedInput
							bind:value={editor.exercise.content.title}
							label={i18n.cms_field_title}
						/>
					</div>
					<div class="mt-4">
						<LocalizedRichText
							bind:value={editor.exercise.content.description}
							label={i18n.cms_field_description}
						/>
					</div>
					{#if !isNew && editor.exercise.id}
						<div class="mt-6">
							<label class="label-text mb-1 block text-sm font-semibold">
								{i18n.cms_exercise_author_label}
							</label>
							<SearchableDropdown
								options={authorOptions}
								value={pendingAuthorId}
								placeholder={i18n.cms_exercise_author_placeholder}
								searchPlaceholder={i18n.cms_course_author_search}
								emptyLabel={i18n.cms_course_author_empty}
								buttonClass="select-bordered select select-sm w-full text-left"
								onChange={handleSelectAuthor}
							/>
							<p class="mt-1 text-xs text-base-content/60">
								{i18n.cms_exercise_author_hint}
							</p>
						</div>
					{/if}
					<div class="divider"></div>
					<TypeModeSelector
						bind:type={editor.exercise.type}
						bind:mode={editor.exercise.config.mode}
					/>
					<div class="divider"></div>
				{/if}

				{#if editor.activeSection === 'blocks'}
					<div class="space-y-4">
						<div>
							<h2 class="font-bold">{i18n.cms_blocks_title}</h2>
							<p class="text-sm text-base-content/60">{i18n.cms_blocks_hint}</p>
						</div>

						<div class="grid gap-3 lg:grid-cols-2">
							<div class="rounded-xl border border-base-300 bg-base-100 p-4">
								<div class="text-sm font-medium">{i18n.cms_blocks_status}</div>
								<div class="mt-1 text-sm text-base-content/70">
									{editor.selectedBlockCount}
									{i18n.cms_blockpicker_selected}
								</div>
							</div>

							<div class="rounded-xl border border-base-300 bg-base-100 p-4">
								<div class="text-sm font-medium">{i18n.cms_starter_title}</div>
								<div class="mt-1 text-sm text-base-content/70">
									{editor.exercise.config.hasStarterBlocks
										? i18n.cms_starter_enabled_hint
										: i18n.cms_starter_disabled_hint}
								</div>
							</div>
						</div>

						<BlockPicker
							bind:selectedBlocks={editor.exercise.config.toolbox}
							exerciseType={editor.exercise.type}
						/>

						<div class="divider"></div>

						<section class="space-y-3">
							<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
								<div>
									<h2 class="font-bold">{i18n.cms_starter_title}</h2>
									<p class="text-sm text-base-content/60">{i18n.cms_starter_hint}</p>
								</div>

								<label
									class="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300 bg-base-100 px-3 py-2"
								>
									<input
										type="checkbox"
										class="checkbox checkbox-primary"
										checked={editor.exercise.config.hasStarterBlocks}
										onchange={(e) =>
											editor.toggleStarterBlocks((e.currentTarget as HTMLInputElement).checked)}
									/>
									<span class="label-text font-medium">{i18n.cms_starter_toggle}</span>
								</label>
							</div>

							{#if editor.exercise.config.hasStarterBlocks}
								<div class="rounded-xl border border-base-300 bg-base-100 p-4">
									<div class="mb-3 rounded-lg bg-base-200 p-3 text-sm text-base-content/70">
										{i18n.cms_starter_builder_hint}
									</div>

									{#key editor.starterWorkspaceKey}
										<BlocklyWorkspace
											bind:this={blocklyRef}
											toolboxConfig={editor.getToolbox()}
											starterXml={editor.exercise.config.starterXml}
											ariaLabel={i18n.cms_starter_title}
										/>
									{/key}

									<div class="mt-3 flex flex-wrap gap-2">
										<button
											type="button"
											class="btn btn-sm btn-primary"
											onclick={captureStarterXml}
										>
											{i18n.cms_starter_save}
										</button>
										<button
											type="button"
											class="btn btn-ghost btn-sm"
											onclick={() => editor.resetStarterWorkspace()}
										>
											{i18n.cms_starter_reset}
										</button>
										<button
											type="button"
											class="btn btn-ghost btn-sm"
											onclick={clearStarterWorkspace}
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
									<p class="mt-2 text-sm text-base-content/65">{i18n.cms_starter_empty_hint}</p>
									<button
										type="button"
										class="btn mt-4 btn-sm btn-primary"
										onclick={() => editor.toggleStarterBlocks(true)}
									>
										{i18n.cms_starter_enable}
									</button>
								</div>
							{/if}
						</section>
					</div>
				{/if}

				{#if editor.activeSection === 'canvas'}
					{#if editor.exercise.type === 'io'}
						<div class="space-y-4">
							<div>
								<h2 class="font-bold">{i18n.cms_exercise_section_io}</h2>
								<p class="mb-4 text-sm text-base-content/60">{i18n.cms_io_section_hint}</p>
							</div>

							<IoTestsEditor
								bind:tests={editor.exercise.config.io.tests}
								bind:normalization={editor.exercise.config.io.normalization}
								bind:visibleExampleInput={editor.exercise.config.io.visibleExampleInput}
								bind:visibleExampleOutput={editor.exercise.config.io.visibleExampleOutput}
							/>
						</div>
					{:else}
						<h2 class="font-bold">
							{editor.isRobot ? i18n.cms_robot_grid_title : i18n.cms_canvas_title}
						</h2>
						<p class="mb-4 text-sm text-base-content/60">
							{editor.isRobot ? i18n.cms_robot_grid_hint : i18n.cms_canvas_hint}
						</p>

						{#if editor.isRobot}
							<RobotGridSettings bind:grid={editor.exercise.config.grid} />
						{/if}

						<CanvasToolbar
							bind:showGrid={editor.showGrid}
							bind:drawMode={editor.drawMode}
							bind:hideActor={editor.hideActor}
							pathCount={editor.pathPointCount}
							targetCount={editor.targetCount}
							wallCount={editor.walls.length}
							hasStart={editor.canvasStart != null}
							hasFinish={editor.canvasFinish != null}
							hasSelection={editor.canvasSelected !== null}
							onClear={editor.clearPath}
							onClearAll={editor.clearAll}
							onDeleteSelected={() => canvasRef?.deleteSelected()}
							onSelectModeChange={() => canvasRef?.clearSelection()}
						/>

						<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
							<div class="lg:col-span-2">
								<div class="flex justify-center rounded-lg border border-base-300 bg-base-100 p-4">
									<Canvas
										bind:this={canvasRef}
										engine={editor.getEngine()!}
										actorType={editor.exercise.type === 'turtle' ? 'turtle' : 'robot'}
										editable={true}
										showGrid={editor.showGrid}
										gridSize={editor.canvasGridSize}
										drawMode={editor.drawMode}
										bind:selected={editor.canvasSelected as any}
										pathOverlay={editor.pathOverlay}
										targets={editor.targets}
										walls={editor.walls}
										start={editor.canvasStart}
										finish={editor.canvasFinish}
										hideActor={editor.hideActor}
										onPathChange={editor.updatePath}
										onTargetChange={editor.updateTargets}
										onWallsChange={editor.updateWalls}
										onStartChange={editor.updateStart}
										onFinishChange={editor.updateFinish}
									/>
								</div>
							</div>

							<div class="lg:col-span-1">
								<AutoTestsPanel
									pathOverlay={editor.pathOverlay}
									testCases={editor.exercise.config.grader.testCases}
									appleTolerance={editor.exercise.config.grader.appleTolerance}
									wallTolerance={editor.exercise.config.grader.wallTolerance}
									onAppleToleranceChange={(v) => (editor.exercise.config.grader.appleTolerance = v)}
									onWallToleranceChange={(v) => (editor.exercise.config.grader.wallTolerance = v)}
								/>
							</div>
						</div>

						<div class="mt-6">
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded-lg bg-base-300 px-4 py-3 text-left hover:bg-base-200"
								onclick={() => (editor.showManualTests = !editor.showManualTests)}
							>
								{#if editor.showManualTests}
									<ChevronDown size="20" />
								{:else}
									<ChevronRight size="20" />
								{/if}
								<span class="font-medium">{i18n.cms_manual_tests_title}</span>
								<span class="text-sm text-base-content/60">({i18n.cms_manual_tests_hint})</span>
							</button>

							{#if editor.showManualTests}
								<div class="mt-2 rounded-lg border border-base-300 p-4">
									<TestCaseEditor
										bind:testCases={editor.exercise.config.grader.testCases}
										exerciseType={editor.exercise.type}
									/>
								</div>
							{/if}
						</div>
					{/if}
				{/if}

				{#if editor.activeSection === 'hints'}
					<div class="card bg-base-200">
						<div class="card-body">
							<h2 class="card-title">{i18n.cms_hints_title}</h2>
							<HintEditor bind:hints={editor.exercise.config.hints} />
						</div>
					</div>
				{/if}

				{#if editor.activeSection === 'preview'}
					<PreviewSection
						previewExercise={editor.previewExercise}
						previewVersion={editor.previewVersion}
						validationResult={editor.validationResult}
						onRefresh={editor.refreshPreview}
						onEdit={() => (editor.activeSection = 'basics')}
					/>
				{/if}

				{#if editor.activeSection === 'versions' && !editor.isNew && editor.exercise.id && editor.versionHistory}
					<VersionHistoryPanel
						versions={versionItems}
						loading={versionData === null}
						restoringVersionId={editor.restoringVersionId}
						onRestoreVersion={editor.requestRestoreVersion}
					/>
				{/if}
			</div>
		</div>
	</div>
</div>

<ConfirmModal
	bind:open={editor.restoreVersionConfirmOpen}
	message={i18n.confirm_restore_version}
	confirmLabel={i18n.cms_restore}
	onConfirm={editor.confirmRestoreVersion}
	onCancel={editor.clearRestoreVersionConfirmation}
/>
