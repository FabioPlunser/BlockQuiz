<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';
	import Boundary from '$cp/Boundary.svelte';
	import SearchableDropdown from '$cp/SearchableDropdown.svelte';
	import {
		getClass,
		removeClassMembers,
		setClassMembers
	} from '$remote/classes.remote';
	import { getAssignableStudents } from '$remote/users.remote';
	import { showError, showSuccess } from '$lib/utils/toast';
	import { Trash2, BookOpen, Lock } from '@lucide/svelte';

	let {
		open = $bindable(),
		classId,
		onClose
	}: {
		open: boolean;
		classId: string | null;
		onClose: () => void;
	} = $props();

	let tab = $state<'members' | 'courses'>('members');

	// Reactive handles read via .current so Boundary's $effect.pending() drives
	// the spinner — and refresh() actually re-shows pending state.
	const classHandle = $derived(classId ? getClass({ id: classId }) : null);
	const studentsHandle = getAssignableStudents();
	const cls = $derived(classHandle?.current ?? null);
	const studentOptions = $derived(
		(studentsHandle.current ?? []).map((s) => ({
			value: s.id,
			label: s.email ?? s.id
		}))
	);

	let dialogRef: HTMLDialogElement;
	$effect(() => {
		if (dialogRef && open) dialogRef.showModal();
		else if (dialogRef && !open) dialogRef.close();
	});

	function handleClose() {
		open = false;
		tab = 'members';
		onClose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialogRef) handleClose();
	}

	async function persistMemberSet(nextValues: string[]) {
		if (!classId) return;
		const result = await setClassMembers({ classId, userIds: nextValues });
		if (!result.success) {
			showError(result.error ?? i18n.toast_generic_error);
			return;
		}
		if (result.added > 0 || result.removed > 0) {
			showSuccess(result.added > 0 ? i18n.class_member_added : i18n.class_member_removed);
		}
		await getClass({ id: classId }).refresh();
	}

	async function handleRemove(member: { id: string; email: string; source: 'sso' | 'manual' }) {
		if (!classId) return;
		const message = i18n.class_member_remove_confirm.replace('{email}', member.email);
		if (!confirm(message)) return;
		const force = member.source === 'sso';
		const result = await removeClassMembers({
			classId,
			userIds: [member.id],
			force
		});
		if (result.success) {
			showSuccess(i18n.class_member_removed);
			await getClass({ id: classId }).refresh();
		} else {
			showError(i18n.toast_generic_error);
		}
	}

	function courseTitle(content: unknown): string {
		if (content && typeof content === 'object') {
			const obj = content as Record<string, unknown>;
			const localized = obj[i18n.locale];
			if (typeof localized === 'string') return localized;
			const en = obj.en;
			if (typeof en === 'string') return en;
		}
		return '(untitled)';
	}
</script>

<dialog
	bind:this={dialogRef}
	class="modal"
	onclick={handleBackdropClick}
	onclose={handleClose}
>
	<div class="modal-box max-w-3xl">
		<Boundary>
			{#if !cls}
				<div class="alert alert-warning">Class not found.</div>
			{:else}
				{@const isIdpOwned = cls.ssoProviderId != null}
				{@const ssoMemberIds = cls.members
					.filter((m) => m.source === 'sso')
					.map((m) => m.id)}
				{@const currentMemberIds = cls.members.map((m) => m.id)}
				{@const ssoBadges = Object.fromEntries(
					ssoMemberIds.map((id) => [id, i18n.class_dropdown_idp_suffix])
				)}

				<div class="mb-3">
					<h3 class="text-lg font-bold">
						{cls.name}
						{#if isIdpOwned}
							<span class="badge badge-sm badge-info">{i18n.classes_source_sso_badge}</span>
						{:else}
							<span class="badge badge-sm badge-ghost">
								{i18n.classes_source_manual_badge}
							</span>
						{/if}
						{#if cls.archivedAt}
							<span class="badge badge-sm badge-warning">{i18n.classes_archived_badge}</span>
						{/if}
					</h3>
					{#if cls.description}
						<p class="text-sm text-base-content/70">{cls.description}</p>
					{/if}
					{#if isIdpOwned}
						<p class="mt-1 text-xs text-base-content/60">
							IdP: <span class="font-mono">{cls.providerDomain}</span> ·
							{i18n.classes_table_external_key}:
							<span class="font-mono">{cls.externalKey}</span>
						</p>
					{/if}
				</div>

				<div class="tabs-box tabs">
					<button
						class="tab"
						class:tab-active={tab === 'members'}
						onclick={() => (tab = 'members')}
					>
						{i18n.class_detail_members_tab} ({cls.members.length})
					</button>
					<button
						class="tab"
						class:tab-active={tab === 'courses'}
						onclick={() => (tab = 'courses')}
					>
						{i18n.class_detail_courses_tab} ({cls.courses.length})
					</button>
				</div>

				<div class="mt-4">
					{#if tab === 'members'}
						<div class="mb-3 flex items-center justify-between gap-3">
							<span class="text-sm font-semibold">{i18n.class_detail_members_tab}</span>
							{#if isIdpOwned}
								<span
									class="inline-flex items-center gap-1 text-xs text-base-content/60"
									title={i18n.class_member_sso_locked}
								>
									<Lock class="h-3 w-3" />
									{i18n.class_idp_locked_short}
								</span>
							{:else}
								<SearchableDropdown
									options={studentOptions}
									multiSelect
									values={currentMemberIds}
									disabledValues={ssoMemberIds}
									optionBadges={ssoBadges}
									placeholder={i18n.class_dropdown_member_placeholder}
									searchPlaceholder={i18n.class_member_search_placeholder}
									doneLabel={i18n.class_dropdown_done}
									multiSelectedTemplate={i18n.class_dropdown_n_selected}
									emptyLabel={i18n.class_dropdown_empty}
									buttonClass="select-bordered select select-sm w-72 text-left"
									onChangeMulti={persistMemberSet}
								/>
							{/if}
						</div>
						{#if isIdpOwned}
							<div class="mb-4 rounded-box bg-base-200 px-3 py-2 text-xs text-base-content/70">
								{i18n.class_idp_locked_hint}
							</div>
						{/if}

						{#if cls.members.length === 0}
							<div class="rounded-box bg-base-200 p-4 text-sm text-base-content/70">
								{i18n.class_no_members}
							</div>
						{:else}
							<div class="overflow-x-auto">
								<table class="table table-sm table-zebra">
									<thead>
										<tr>
											<th>{i18n.users_table_email}</th>
											<th>{i18n.users_table_role}</th>
											<th>{i18n.classes_table_source}</th>
											<th></th>
										</tr>
									</thead>
									<tbody>
										{#each cls.members as m (m.membershipId)}
											<tr>
												<td>{m.email}</td>
												<td>{m.role}</td>
												<td>
													{#if m.source === 'sso'}
														<span
															class="badge badge-sm badge-info"
															title={i18n.class_member_sso_locked}
														>
															{i18n.class_member_source_sso}
														</span>
													{:else}
														<span class="badge badge-sm badge-ghost">
															{i18n.class_member_source_manual}
														</span>
													{/if}
												</td>
												<td class="text-right">
													<button
														class="btn text-error btn-ghost btn-xs"
														aria-label={i18n.class_member_remove}
														onclick={() => handleRemove(m)}
													>
														<Trash2 class="h-3 w-3" />
													</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					{:else if cls.courses.length === 0}
						<div class="rounded-box bg-base-200 p-4 text-sm text-base-content/70">
							{i18n.class_no_courses}
						</div>
					{:else}
						<ul class="divide-y divide-base-200">
							{#each cls.courses as c (c.courseId)}
								<li class="flex items-center justify-between py-2">
									<div>
										<BookOpen class="mr-1 inline h-3 w-3 text-base-content/60" />
										<span class="font-medium">{courseTitle(c.content)}</span>
										{#if !c.published}
											<span class="ml-2 badge badge-sm badge-ghost">draft</span>
										{/if}
										<span class="ml-2 font-mono text-xs text-base-content/50">{c.courseId}</span>
									</div>
									<span class="text-xs text-base-content/60">
										{i18n.class_courses_attached_at}: {new Date(
											c.attachedAt
										).toLocaleDateString()}
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</Boundary>

		<div class="modal-action">
			<button class="btn" onclick={handleClose}>{i18n.modal_close}</button>
		</div>
	</div>
</dialog>
