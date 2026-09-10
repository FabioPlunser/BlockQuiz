<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { i18n } from '$lib/i18n/index.svelte';
	import { completePasswordReset } from '$remote/auth.remote';
	import { showError, showSuccess } from '$lib/utils/toast';
	import { onMount } from 'svelte';

	let mounted = $state(false);
	let confirmValue = $state('');
	let mismatchError = $state('');
	let token = $derived(page.url.searchParams.get('token') ?? '');
	let issues = $derived(completePasswordReset.fields.allIssues() ?? []);

	onMount(() => {
		mounted = true;
	});
</script>

<svelte:head>
	<title>{i18n.reset_password_title} | BlockQuiz</title>
</svelte:head>

{#if mounted}
	<section class="flex justify-center">
		<div class="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl shadow-purple-200 backdrop-blur">
			<h1 class="text-2xl font-semibold text-slate-900">{i18n.reset_password_title}</h1>

			{#if !token}
				<p class="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
					{i18n.reset_password_token_missing}
				</p>
				<div class="mt-6 flex justify-end">
					<a class="btn btn-info" href={resolve('/login')}>{i18n.reset_password_back_to_login}</a>
				</div>
			{:else}
				<p class="mt-2 text-sm text-slate-600">{i18n.reset_password_intro}</p>

				<form
					class="mt-6 space-y-5"
					{...completePasswordReset.enhance(async ({ submit, form: formEl }) => {
						mismatchError = '';
						const password = (formEl.elements.namedItem('password') as HTMLInputElement)?.value;
						if (password !== confirmValue) {
							mismatchError = i18n.reset_password_mismatch;
							return;
						}

						try {
							await submit();
							const remoteIssues = completePasswordReset.fields.allIssues() ?? [];
							if (remoteIssues.length > 0) {
								showError(remoteIssues[0].message);
								return;
							}
							showSuccess(i18n.reset_password_success);
							goto(resolve('/login'));
						} catch (e) {
							console.error(e);
							showError(i18n.toast_login_failed);
						}
					})}
				>
					<input type="hidden" {...completePasswordReset.fields.token.as('text')} value={token} />

					<div class="space-y-2">
						<label class="text-sm font-medium text-slate-700" for="new-password">
							{i18n.reset_password_new_label}
						</label>
						<input
							id="new-password"
							{...completePasswordReset.fields.password.as('password')}
							class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none"
						/>
					</div>

					<div class="space-y-2">
						<label class="text-sm font-medium text-slate-700" for="confirm-password">
							{i18n.reset_password_confirm_label}
						</label>
						<input
							id="confirm-password"
							type="password"
							bind:value={confirmValue}
							class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none"
						/>
					</div>

					{#if mismatchError}
						<span class="text-sm text-rose-600">{mismatchError}</span>
					{/if}

					{#each issues as issue (`${issue.path}-${issue.message}`)}
						<span class="text-sm text-rose-600">{issue.message}</span>
					{/each}

					<div class="flex items-center justify-between gap-3">
						<a class="btn btn-ghost" href={resolve('/login')}>
							{i18n.reset_password_back_to_login}
						</a>
						<button class="btn btn-primary" type="submit">
							{i18n.reset_password_submit_button}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</section>
{/if}
