<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';
	import { requestPasswordReset } from '$remote/auth.remote';
	import { showError } from '$lib/utils/toast';

	// eslint-disable-next-line no-useless-assignment -- $bindable default is consumed by Svelte's runtime, not the surrounding code
	let { forgot = $bindable() } = $props();
	let submitted = $state(false);

	let issues = $derived(requestPasswordReset.fields.allIssues() ?? []);
</script>

<h2 class="text-2xl font-semibold text-slate-900">{i18n.forgot_password_title}</h2>

{#if submitted}
	<p class="mt-4 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
		<strong class="block">{i18n.forgot_password_requested_title}</strong>
		<span class="mt-1 block">{i18n.forgot_password_requested_message}</span>
	</p>
	<div class="mt-6 flex justify-end">
		<button class="btn btn-info" type="button" onclick={() => (forgot = false)}>
			{i18n.forgot_password_back}
		</button>
	</div>
{:else}
	<p class="mt-4 text-sm text-slate-600">{i18n.forgot_password_intro}</p>
	<form
		class="mt-6 space-y-5"
		{...requestPasswordReset.enhance(async ({ submit }) => {
			try {
				await submit();
				const remoteIssues = requestPasswordReset.fields.allIssues() ?? [];
				if (remoteIssues.length > 0) {
					showError(remoteIssues[0].message);
					return;
				}
				submitted = true;
			} catch (e) {
				console.error(e);
				showError(i18n.toast_login_failed);
			}
		})}
	>
		<div class="space-y-2">
			<label class="text-sm font-medium text-slate-700" for="forgot-email">
				{i18n.forgot_password_email_label}
			</label>
			<input
				id="forgot-email"
				{...requestPasswordReset.fields.email.as('email')}
				class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner focus:border-sky-400 focus:ring-2 focus:ring-sky-200 focus:outline-none"
			/>
		</div>

		{#each issues as issue (`${issue.path}-${issue.message}`)}
			<span class="text-sm text-rose-600">{issue.message}</span>
		{/each}

		<div class="flex items-center justify-between gap-3">
			<button class="btn btn-info" type="button" onclick={() => (forgot = false)}>
				{i18n.forgot_password_back}
			</button>
			<button class="btn btn-primary" type="submit">
				{i18n.forgot_password_request_button}
			</button>
		</div>
	</form>
{/if}
