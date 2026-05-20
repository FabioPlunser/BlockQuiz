<script lang="ts">
	import Modal from '$cp/Modal.svelte';
	import { i18n } from '$lib/i18n/index.svelte';
	import { saveClass, getClasses } from '$remote/classes.remote';

	type EditingClass = {
		id: string;
		name: string;
		description: string | null;
		ssoProviderId: string | null;
		externalKey: string | null;
	} | null;

	type Provider = { id: string; domain: string };

	let {
		open = $bindable(),
		editing,
		providers,
		onClose
	}: {
		open: boolean;
		editing: EditingClass;
		providers: Provider[];
		onClose: () => void;
	} = $props();

	// SvelteKit's form-fields helper is controlled — the spread from `.as('text')`
	// installs its own value getter/setter. Writing `value={editing?.x}` only
	// sets the DOM attribute and never reaches the helper's internal state, so
	// the form submits empty. Pre-fill via `field.set(...)` every time the modal
	// opens or the editing target changes.
	$effect(() => {
		if (!open) return;
		saveClass.fields.id.set(editing?.id ?? '');
		saveClass.fields.name.set(editing?.name ?? '');
		saveClass.fields.description.set(editing?.description ?? '');
		saveClass.fields.ssoProviderId.set(editing?.ssoProviderId ?? '');
		saveClass.fields.externalKey.set(editing?.externalKey ?? '');
	});
</script>

<Modal
	remoteFunction={saveClass}
	bind:open
	title={editing ? i18n.class_edit_title : i18n.class_create_title}
	successMessage={i18n.class_saved}
	updates={[getClasses]}
	{onClose}
>
	<input {...saveClass.fields.id.as('text')} type="hidden" />

	<div class="grid gap-4">
		<label class="flex flex-col gap-1">
			<span class="label-text text-sm font-semibold">{i18n.class_field_name}</span>
			<input
				{...saveClass.fields.name.as('text')}
				placeholder={i18n.class_field_name_placeholder}
				class="input-bordered input"
			/>
		</label>

		<label class="flex flex-col gap-1">
			<span class="label-text text-sm font-semibold">{i18n.class_field_description}</span>
			<input {...saveClass.fields.description.as('text')} class="input-bordered input" />
		</label>

		<label class="flex flex-col gap-1">
			<span class="label-text text-sm font-semibold">{i18n.class_field_provider}</span>
			<select {...saveClass.fields.ssoProviderId.as('select')} class="select-bordered select">
				<option value="">{i18n.class_field_provider_none}</option>
				{#each providers as p (p.id)}
					<option value={p.id}>{p.domain}</option>
				{/each}
			</select>
		</label>

		<label class="flex flex-col gap-1">
			<span class="label-text text-sm font-semibold">
				{i18n.class_field_external_key}
			</span>
			<input
				{...saveClass.fields.externalKey.as('text')}
				placeholder="CN=class-9A,OU=Classes,DC=school,DC=test"
				class="input-bordered input font-mono text-xs"
			/>
			<span class="text-xs text-base-content/60">
				{i18n.class_field_external_key_hint}
			</span>
		</label>
	</div>

	{#each saveClass.fields.allIssues() as issue (`${issue.path}-${issue.message}`)}
		<div class="text-sm text-error">{issue.path}: {issue.message}</div>
	{/each}

	{#snippet controls()}
		<button class="btn btn-primary" type="submit">{i18n.class_save}</button>
	{/snippet}
</Modal>
