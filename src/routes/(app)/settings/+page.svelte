<script lang="ts">
	import { resolve } from '$app/paths';
	import { i18n } from '$lib/i18n/index.svelte';
	import {
		getEmailSettings,
		saveEmailSettings,
		sendTestEmail,
		getSsoProviders,
		saveSsoProvider,
		deleteSsoProvider,
		getRoleMap,
		saveRoleMap,
		getAuthSettings,
		saveAuthSettings
	} from '$remote/settings.remote';
	import Loading from '$cp/Loading.svelte';
	import Modal from '$cp/Modal.svelte';
	import { showSuccess, showError } from '$lib/utils/toast';
	import { ShieldCheck, Mail, Users, Plus, Trash2, Pencil, Copy } from '@lucide/svelte';

	let { data } = $props();

	type ProviderRow = {
		id: string;
		providerId: string;
		issuer: string;
		domain: string;
		discoveryEndpoint: string;
		clientId: string;
		scopes: string;
		clientSecretSet: boolean;
		callbackUrl: string;
	};

	let providerModalOpen = $state(false);
	let editingProvider = $state<ProviderRow | null>(null);
	let newProviderId = $state(''); // pre-generated UUID for a new provider, shown before save

	function openNewProvider() {
		editingProvider = null;
		newProviderId = crypto.randomUUID();
		providerModalOpen = true;
	}

	function openEditProvider(p: ProviderRow) {
		editingProvider = p;
		providerModalOpen = true;
	}

	async function handleDeleteProvider(p: ProviderRow) {
		if (!confirm(i18n.settings_sso_delete_confirm.replace('{id}', p.providerId))) return;
		const result = await deleteSsoProvider({ providerId: p.providerId });
		if (result?.success) {
			showSuccess(i18n.settings_sso_deleted);
			await getSsoProviders().refresh();
		} else {
			showError(result?.error ?? i18n.toast_generic_error);
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text).then(
			() => showSuccess(i18n.settings_copied),
			() => showError(i18n.toast_generic_error)
		);
	}

	const driverOptions = [
		{ value: 'file', label: 'File outbox' },
		{ value: 'smtp', label: 'SMTP' },
		{ value: 'graph', label: 'Microsoft Graph' }
	];
</script>

<svelte:head>
	<title>{i18n.settings_title} | BlockQuiz</title>
</svelte:head>

<main class="space-y-6 p-4 md:p-6">
	<!-- SSO Providers -->
	<section class="card border border-base-300 bg-base-100 shadow-sm">
		<div class="card-body gap-4">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="flex items-center gap-2 text-sm font-semibold text-primary">
						<ShieldCheck class="h-4 w-4" />
						{i18n.settings_sso_kicker}
					</p>
					<h3 class="card-title">{i18n.settings_sso_title}</h3>
					<p class="mt-1 text-sm text-base-content/70">{i18n.settings_sso_description}</p>
				</div>
				<button class="btn btn-sm btn-primary" onclick={openNewProvider}>
					<Plus class="h-4 w-4" />
					{i18n.settings_sso_add}
				</button>
			</div>

			<svelte:boundary>
				{#snippet pending()}<Loading />{/snippet}
				{#snippet failed(error, reset)}
					<div class="alert alert-error">
						<span>{String(error)}</span>
						<button class="btn btn-sm" onclick={reset}>{i18n.try_again}</button>
					</div>
				{/snippet}

				{@const providers = await getSsoProviders()}
				{#if providers.length === 0}
					<div class="rounded-box bg-base-200 p-4 text-sm text-base-content/70">
						{i18n.settings_sso_empty}
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr>
									<th>{i18n.settings_sso_provider_id}</th>
									<th>{i18n.settings_sso_domain}</th>
									<th>{i18n.settings_sso_issuer}</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{#each providers as p (p.providerId)}
									<tr>
										<td class="font-mono text-sm">{p.providerId}</td>
										<td>{p.domain}</td>
										<td class="max-w-xs truncate text-xs text-base-content/70">{p.issuer}</td>
										<td class="flex gap-2">
											<button
												class="btn btn-ghost btn-xs"
												onclick={() => openEditProvider(p as ProviderRow)}
												aria-label="Edit"
											>
												<Pencil class="h-4 w-4" />
											</button>
											<button
												class="btn text-error btn-ghost btn-xs"
												onclick={() => handleDeleteProvider(p as ProviderRow)}
												aria-label="Delete"
											>
												<Trash2 class="h-4 w-4" />
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</svelte:boundary>

			<svelte:boundary>
				{#snippet pending()}{/snippet}
				{#snippet failed(error, reset)}
					<div class="alert alert-error">
						<span>{String(error)}</span>
						<button class="btn btn-sm" onclick={reset}>{i18n.try_again}</button>
					</div>
				{/snippet}
				{@const authCfg = await getAuthSettings()}
				<form
					{...saveAuthSettings.enhance(async ({ submit }) => {
						try {
							await submit();
							const issues = saveAuthSettings.fields.allIssues();
							if (!issues || issues.length === 0) {
								showSuccess(i18n.settings_auth_saved);
								await getAuthSettings().refresh();
							} else {
								showError(issues[0].message);
							}
						} catch (e) {
							showError(e instanceof Error ? e.message : i18n.toast_generic_error);
						}
					})}
					class="grid gap-3 border-t border-base-200 pt-4"
				>
					<label class="flex flex-col gap-1">
						<span class="label-text text-sm font-semibold">{i18n.settings_auth_mode_label}</span>
						<select
							{...saveAuthSettings.fields.mode.as('select')}
							class="select-bordered select select-sm"
						>
							<option value="always" selected={authCfg.passwordLoginMode === 'always'}>
								{i18n.settings_auth_mode_always}
							</option>
							<option value="fallback" selected={authCfg.passwordLoginMode === 'fallback'}>
								{i18n.settings_auth_mode_fallback}
							</option>
						</select>
						<span class="text-xs text-base-content/60">{i18n.settings_auth_mode_hint}</span>
					</label>
					<div>
						<button type="submit" class="btn btn-primary btn-sm">{i18n.settings_save}</button>
					</div>
				</form>
			</svelte:boundary>
		</div>
	</section>

	<!-- Email transport -->
	<section class="card border border-base-300 bg-base-100 shadow-sm">
		<div class="card-body gap-4">
			<div>
				<p class="flex items-center gap-2 text-sm font-semibold text-secondary">
					<Mail class="h-4 w-4" />
					{i18n.settings_email_kicker}
				</p>
				<h3 class="card-title">{i18n.settings_email_title}</h3>
				<p class="mt-1 text-sm text-base-content/70">{i18n.settings_email_description}</p>
			</div>

			<svelte:boundary>
				{#snippet pending()}<Loading />{/snippet}
				{#snippet failed(error, reset)}
					<div class="alert alert-error">
						<span>{String(error)}</span>
						<button class="btn btn-sm" onclick={reset}>{i18n.try_again}</button>
					</div>
				{/snippet}

				{@const emailCfg = await getEmailSettings()}

				<form
					{...saveEmailSettings.enhance(async ({ submit }) => {
						try {
							await submit();
							const issues = saveEmailSettings.fields.allIssues();
							if (!issues || issues.length === 0) {
								showSuccess(i18n.settings_email_saved);
								await getEmailSettings().refresh();
							} else {
								showError(issues[0].message);
							}
						} catch (e) {
							showError(e instanceof Error ? e.message : i18n.toast_generic_error);
						}
					})}
					class="grid gap-4"
				>
					<div class="grid gap-4 md:grid-cols-2">
						<label class="flex flex-col gap-1">
							<span class="label-text text-sm font-semibold">
								{i18n.settings_email_driver}
								{#if emailCfg.envOverrides.driver}
									<span class="badge badge-sm badge-warning">{i18n.settings_env_override}</span>
								{/if}
							</span>
							<select
								{...saveEmailSettings.fields.driver.as('select')}
								class="select-bordered select"
								disabled={emailCfg.envOverrides.driver}
							>
								{#each driverOptions as o (o.value)}
									<option value={o.value} selected={o.value === emailCfg.driver}>
										{o.label}
									</option>
								{/each}
							</select>
						</label>
						<label class="flex flex-col gap-1">
							<span class="label-text text-sm font-semibold">
								{i18n.settings_email_from}
								{#if emailCfg.envOverrides.from}
									<span class="badge badge-sm badge-warning">{i18n.settings_env_override}</span>
								{/if}
							</span>
							<input
								{...saveEmailSettings.fields.from.as('text')}
								value={emailCfg.from}
								placeholder="BlockQuiz <noreply@example.com>"
								class="input-bordered input"
								disabled={emailCfg.envOverrides.from}
							/>
						</label>
					</div>

					<fieldset class="rounded-box border border-base-300 p-4">
						<legend class="px-2 text-sm font-semibold">{i18n.settings_email_smtp_legend}</legend>
						<div class="grid gap-4 md:grid-cols-2">
							<label class="flex flex-col gap-1">
								<span class="label-text text-xs"
									>SMTP host
									{#if emailCfg.envOverrides['smtp.host']}<span class="badge badge-xs badge-warning"
											>env</span
										>{/if}
								</span>
								<input
									{...saveEmailSettings.fields.smtpHost.as('text')}
									value={emailCfg.smtp.host}
									placeholder="smtp.gmail.com"
									class="input-bordered input input-sm"
									disabled={emailCfg.envOverrides['smtp.host']}
								/>
							</label>
							<label class="flex flex-col gap-1">
								<span class="label-text text-xs"
									>Port
									{#if emailCfg.envOverrides['smtp.port']}<span class="badge badge-xs badge-warning"
											>env</span
										>{/if}
								</span>
								<input
									{...saveEmailSettings.fields.smtpPort.as('text')}
									value={String(emailCfg.smtp.port)}
									placeholder="587"
									class="input-bordered input input-sm"
									disabled={emailCfg.envOverrides['smtp.port']}
								/>
							</label>
							<label class="flex flex-col gap-1">
								<span class="label-text text-xs"
									>User
									{#if emailCfg.envOverrides['smtp.user']}<span class="badge badge-xs badge-warning"
											>env</span
										>{/if}
								</span>
								<input
									{...saveEmailSettings.fields.smtpUser.as('text')}
									value={emailCfg.smtp.user}
									placeholder="account@gmail.com"
									class="input-bordered input input-sm"
									disabled={emailCfg.envOverrides['smtp.user']}
								/>
							</label>
							<label class="flex flex-col gap-1">
								<span class="label-text text-xs">
									Password
									{#if emailCfg.smtp.passwordSet}
										<span class="badge badge-xs badge-success">{i18n.settings_secret_set}</span>
									{/if}
									{#if emailCfg.envOverrides['smtp.password']}<span
											class="badge badge-xs badge-warning">env</span
										>{/if}
								</span>
								<input
									{...saveEmailSettings.fields.smtpPassword.as('password')}
									placeholder={emailCfg.smtp.passwordSet
										? '••••••• (leave blank to keep)'
										: 'app password'}
									class="input-bordered input input-sm"
									disabled={emailCfg.envOverrides['smtp.password']}
								/>
							</label>
							<label class="flex flex-col gap-1 md:col-span-2">
								<span class="label-text text-xs"
									>TLS
									{#if emailCfg.envOverrides['smtp.secure']}<span
											class="badge badge-xs badge-warning">env</span
										>{/if}
								</span>
								<select
									{...saveEmailSettings.fields.smtpSecure.as('select')}
									class="select-bordered select select-sm"
									disabled={emailCfg.envOverrides['smtp.secure']}
								>
									<option value="auto" selected={emailCfg.smtp.secure == null}
										>Auto (port 465 = TLS)</option
									>
									<option value="true" selected={emailCfg.smtp.secure === true}>Force TLS</option>
									<option value="false" selected={emailCfg.smtp.secure === false}>STARTTLS</option>
								</select>
							</label>
						</div>
					</fieldset>

					<fieldset class="rounded-box border border-base-300 p-4">
						<legend class="px-2 text-sm font-semibold">{i18n.settings_email_graph_legend}</legend>
						<div class="grid gap-4 md:grid-cols-2">
							<label class="flex flex-col gap-1">
								<span class="label-text text-xs"
									>Tenant ID
									{#if emailCfg.envOverrides['graph.tenantId']}<span
											class="badge badge-xs badge-warning">env</span
										>{/if}
								</span>
								<input
									{...saveEmailSettings.fields.graphTenantId.as('text')}
									value={emailCfg.graph.tenantId}
									class="input-bordered input input-sm"
									disabled={emailCfg.envOverrides['graph.tenantId']}
								/>
							</label>
							<label class="flex flex-col gap-1">
								<span class="label-text text-xs"
									>Client ID
									{#if emailCfg.envOverrides['graph.clientId']}<span
											class="badge badge-xs badge-warning">env</span
										>{/if}
								</span>
								<input
									{...saveEmailSettings.fields.graphClientId.as('text')}
									value={emailCfg.graph.clientId}
									class="input-bordered input input-sm"
									disabled={emailCfg.envOverrides['graph.clientId']}
								/>
							</label>
							<label class="flex flex-col gap-1">
								<span class="label-text text-xs">
									Client secret
									{#if emailCfg.graph.clientSecretSet}
										<span class="badge badge-xs badge-success">{i18n.settings_secret_set}</span>
									{/if}
									{#if emailCfg.envOverrides['graph.clientSecret']}<span
											class="badge badge-xs badge-warning">env</span
										>{/if}
								</span>
								<input
									{...saveEmailSettings.fields.graphClientSecret.as('password')}
									placeholder={emailCfg.graph.clientSecretSet
										? '••••••• (leave blank to keep)'
										: ''}
									class="input-bordered input input-sm"
									disabled={emailCfg.envOverrides['graph.clientSecret']}
								/>
							</label>
							<label class="flex flex-col gap-1">
								<span class="label-text text-xs"
									>From mailbox (UPN)
									{#if emailCfg.envOverrides['graph.fromUser']}<span
											class="badge badge-xs badge-warning">env</span
										>{/if}
								</span>
								<input
									{...saveEmailSettings.fields.graphFromUser.as('text')}
									value={emailCfg.graph.fromUser}
									placeholder="noreply@school.onmicrosoft.com"
									class="input-bordered input input-sm"
									disabled={emailCfg.envOverrides['graph.fromUser']}
								/>
							</label>
						</div>
					</fieldset>

					<div class="flex flex-wrap items-center gap-2">
						<button type="submit" class="btn btn-primary">{i18n.settings_save}</button>
						<button
							type="button"
							class="btn btn-ghost"
							onclick={async () => {
								const result = await sendTestEmail({});
								if (result?.success) {
									showSuccess(i18n.settings_email_test_sent.replace('{to}', result.to));
								} else {
									showError(result?.error ?? i18n.toast_generic_error);
								}
							}}
						>
							{i18n.settings_email_test_send}
						</button>
					</div>
					{#each saveEmailSettings.fields.allIssues() as issue (issue.path)}
						<div class="text-sm text-error">{issue.path}: {issue.message}</div>
					{/each}
				</form>
			</svelte:boundary>
		</div>
	</section>

	<!-- Role mapping -->
	<section class="card border border-base-300 bg-base-100 shadow-sm">
		<div class="card-body gap-4">
			<div>
				<p class="flex items-center gap-2 text-sm font-semibold text-accent">
					<Users class="h-4 w-4" />
					{i18n.settings_role_kicker}
				</p>
				<h3 class="card-title">{i18n.settings_role_title}</h3>
				<p class="mt-1 text-sm text-base-content/70">{i18n.settings_role_description}</p>
			</div>

			<svelte:boundary>
				{#snippet pending()}<Loading />{/snippet}
				{#snippet failed(error, reset)}
					<div class="alert alert-error">
						<span>{String(error)}</span>
						<button class="btn btn-sm" onclick={reset}>{i18n.try_again}</button>
					</div>
				{/snippet}

				{@const roleMap = await getRoleMap()}
				<form
					{...saveRoleMap.enhance(async ({ submit }) => {
						try {
							await submit();
							const issues = saveRoleMap.fields.allIssues();
							if (!issues || issues.length === 0) {
								showSuccess(i18n.settings_role_saved);
								await getRoleMap().refresh();
							} else {
								showError(issues[0].message);
							}
						} catch (e) {
							showError(e instanceof Error ? e.message : i18n.toast_generic_error);
						}
					})}
					class="grid gap-4 md:grid-cols-3"
				>
					<label class="flex flex-col gap-1">
						<span class="label-text text-sm font-semibold">
							{i18n.role_admin}
							{#if roleMap.envOverrides.admin}
								<span class="badge badge-xs badge-warning">env</span>
							{/if}
						</span>
						<input
							{...saveRoleMap.fields.admin.as('text')}
							value={roleMap.admin}
							placeholder="BlockQuiz-Admins"
							class="input-bordered input input-sm"
							disabled={roleMap.envOverrides.admin}
						/>
					</label>
					<label class="flex flex-col gap-1">
						<span class="label-text text-sm font-semibold">
							{i18n.role_author}
							{#if roleMap.envOverrides.author}
								<span class="badge badge-xs badge-warning">env</span>
							{/if}
						</span>
						<input
							{...saveRoleMap.fields.author.as('text')}
							value={roleMap.author}
							placeholder="ContentAuthors"
							class="input-bordered input input-sm"
							disabled={roleMap.envOverrides.author}
						/>
					</label>
					<label class="flex flex-col gap-1">
						<span class="label-text text-sm font-semibold">
							{i18n.role_teacher}
							{#if roleMap.envOverrides.teacher}
								<span class="badge badge-xs badge-warning">env</span>
							{/if}
						</span>
						<input
							{...saveRoleMap.fields.teacher.as('text')}
							value={roleMap.teacher}
							placeholder="Teachers,Lehrer"
							class="input-bordered input input-sm"
							disabled={roleMap.envOverrides.teacher}
						/>
					</label>
					<div class="md:col-span-3">
						<button type="submit" class="btn btn-sm btn-primary">{i18n.settings_save}</button>
						<p class="mt-2 text-xs text-base-content/60">{i18n.settings_role_hint}</p>
					</div>
				</form>
			</svelte:boundary>
		</div>
	</section>
</main>

<Modal
	remoteFunction={saveSsoProvider}
	bind:open={providerModalOpen}
	successMessage={i18n.settings_sso_saved}
	onClose={() => {
		editingProvider = null;
		getSsoProviders().refresh();
	}}
>
	{@const activeProviderId = editingProvider?.providerId ?? newProviderId}
	{@const callbackUrl =
		editingProvider?.callbackUrl ?? `${data.authBaseUrl}/api/auth/sso/callback/${newProviderId}`}
	<div class="flex flex-col gap-4">
		<div class="mb-2">
			<p class="text-sm font-semibold">{i18n.settings_sso_callback_label}</p>
			<div class="flex items-center gap-2">
				<code class="grow rounded bg-base-200 px-2 py-1 text-xs break-all">{callbackUrl}</code>
				<button
					type="button"
					class="btn btn-ghost btn-xs"
					onclick={() => copyToClipboard(callbackUrl)}
				>
					<Copy class="h-3 w-3" />
				</button>
			</div>
		</div>

		<!-- providerId stays constant for the life of the record. For new providers we
		     pre-generate a UUID client-side so the admin can copy the callback URL to the
		     IdP before saving. For edits, send the existing id back so the server updates
		     the right row. -->
		<input
			{...saveSsoProvider.fields.providerId.as('text')}
			value={activeProviderId}
			type="hidden"
		/>

		<div class="grid gap-4 md:grid-cols-2">
			<label class="flex flex-col gap-1">
				<span class="label-text text-sm font-semibold">{i18n.settings_sso_domain}</span>
				<input
					{...saveSsoProvider.fields.domain.as('text')}
					value={editingProvider?.domain ?? ''}
					placeholder="school-a.example"
					class="input-bordered input"
				/>
			</label>
			<label class="flex flex-col gap-1 md:col-span-2">
				<span class="label-text text-sm font-semibold">{i18n.settings_sso_issuer}</span>
				<input
					{...saveSsoProvider.fields.issuer.as('text')}
					value={editingProvider?.issuer ?? ''}
					placeholder="https://login.microsoftonline.com/<tenant>/v2.0"
					class="input-bordered input"
				/>
			</label>
			<label class="flex flex-col gap-1 md:col-span-2">
				<span class="label-text text-sm font-semibold">{i18n.settings_sso_discovery}</span>
				<input
					{...saveSsoProvider.fields.discoveryEndpoint.as('text')}
					value={editingProvider?.discoveryEndpoint ?? ''}
					placeholder="https://login.microsoftonline.com/<tenant>/v2.0/.well-known/openid-configuration"
					class="input-bordered input"
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="label-text text-sm font-semibold">{i18n.settings_sso_client_id}</span>
				<input
					{...saveSsoProvider.fields.clientId.as('text')}
					value={editingProvider?.clientId ?? ''}
					class="input-bordered input"
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="label-text text-sm font-semibold">
					{i18n.settings_sso_client_secret}
					{#if editingProvider?.clientSecretSet}
						<span class="badge badge-xs badge-success">{i18n.settings_secret_set}</span>
					{/if}
				</span>
				<input
					{...saveSsoProvider.fields.clientSecret.as('password')}
					placeholder={editingProvider?.clientSecretSet ? '••••••• (leave blank to keep)' : ''}
					class="input-bordered input"
				/>
			</label>
			<label class="flex flex-col gap-1 md:col-span-2">
				<span class="label-text text-sm font-semibold">{i18n.settings_sso_scopes}</span>
				<input
					{...saveSsoProvider.fields.scopes.as('text')}
					value={editingProvider?.scopes ?? 'openid profile email'}
					class="input-bordered input"
				/>
			</label>
		</div>
	</div>
	{#each saveSsoProvider.fields.allIssues() as issue (issue.path)}
		<div class="text-sm text-error">{issue.path}: {issue.message}</div>
	{/each}
	{#snippet controls()}
		<button class="btn btn-primary" type="submit">{i18n.settings_save}</button>
	{/snippet}
</Modal>
