<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';
	import Loading from '$cp/Loading.svelte';
	import { getIdpGroupSuggestions, promoteIdpGroup, getClasses } from '$remote/classes.remote';
	import { showError, showSuccess } from '$lib/utils/toast';
	import { Sparkles, CheckCircle2 } from '@lucide/svelte';

	let {
		onPromoted = () => {}
	}: {
		onPromoted?: () => void;
	} = $props();

	const suggestionsQuery = $derived(getIdpGroupSuggestions());

	let promotingId = $state<string | null>(null);
	let promoteName = $state('');

	async function handlePromote(row: { id: string; ssoProviderId: string; externalKey: string }) {
		if (!promoteName.trim()) {
			showError(i18n.discovery_name_required);
			return;
		}
		const result = await promoteIdpGroup({
			ssoProviderId: row.ssoProviderId,
			externalKey: row.externalKey,
			name: promoteName.trim()
		}).updates(getIdpGroupSuggestions, getClasses);
		if (result.success) {
			showSuccess(i18n.discovery_promoted);
			promotingId = null;
			promoteName = '';
			onPromoted();
		} else {
			showError(result.error ?? i18n.toast_generic_error);
		}
	}
</script>

<section class="card border border-base-300 bg-base-100 shadow-sm">
	<div class="card-body gap-3">
		<div>
			<p class="flex items-center gap-2 text-sm font-semibold text-secondary">
				<Sparkles class="h-4 w-4" />
				{i18n.discovery_kicker}
			</p>
			<h3 class="card-title text-base">{i18n.discovery_title}</h3>
			<p class="mt-1 text-sm text-base-content/70">{i18n.discovery_description}</p>
		</div>

		<svelte:boundary>
			{#snippet pending()}<Loading />{/snippet}
			{#snippet failed(error, reset)}
				<div class="alert alert-error">
					<span>{String(error)}</span>
					<button class="btn btn-sm" onclick={reset}>{i18n.try_again}</button>
				</div>
			{/snippet}

			{@const rows = await suggestionsQuery}
			{#if rows.length === 0}
				<div class="rounded-box bg-base-200 p-4 text-sm text-base-content/70">
					{i18n.discovery_empty}
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="table table-zebra">
						<thead>
							<tr>
								<th>{i18n.discovery_table_provider}</th>
								<th>{i18n.discovery_table_external_key}</th>
								<th class="text-right">{i18n.discovery_table_seen}</th>
								<th>{i18n.discovery_table_last_seen}</th>
								<th class="text-right">{i18n.discovery_table_action}</th>
							</tr>
						</thead>
						<tbody>
							{#each rows as row (row.id)}
								<tr>
									<td>{row.providerDomain}</td>
									<td class="font-mono text-xs text-base-content/80">{row.externalKey}</td>
									<td class="text-right">{row.occurrenceCount}</td>
									<td class="text-xs text-base-content/60">
										{new Date(row.lastSeenAt).toLocaleString()}
									</td>
									<td>
										{#if row.matchedClassId}
											<span class="inline-flex items-center gap-1 text-xs text-success">
												<CheckCircle2 class="h-3 w-3" />
												{i18n.discovery_already_promoted}
											</span>
										{:else if promotingId === row.id}
											<div class="flex items-center justify-end gap-2">
												<input
													type="text"
													class="input-bordered input input-xs w-32"
													placeholder={i18n.class_field_name_placeholder}
													bind:value={promoteName}
												/>
												<button class="btn btn-primary btn-xs" onclick={() => handlePromote(row)}>
													{i18n.discovery_promote_save}
												</button>
												<button
													class="btn btn-ghost btn-xs"
													onclick={() => {
														promotingId = null;
														promoteName = '';
													}}
												>
													{i18n.modal_close}
												</button>
											</div>
										{:else}
											<button
												class="btn btn-outline btn-xs"
												onclick={() => {
													promotingId = row.id;
													// Suggest a class name from the last CN= segment, if present.
													const m = row.externalKey.match(/CN=([^,]+)/i);
													promoteName = m ? m[1] : row.externalKey;
												}}
											>
												{i18n.discovery_promote}
											</button>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</svelte:boundary>
	</div>
</section>
