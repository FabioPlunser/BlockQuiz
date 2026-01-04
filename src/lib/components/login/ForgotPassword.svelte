<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { i18n } from '$lib/i18n/index.svelte';
	import { resetPassword } from '$remote/auth.remote';
	import { onMount } from 'svelte';

	let { forgot = $bindable() } = $props();
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});
</script>

{#if mounted}
	<h2 class="text-2xl font-semibold text-slate-900">Reset password</h2>
	<form class="mt-6 space-y-5">
		<div class="space-y-2">
			<label class="text-sm font-medium text-slate-700" for="email">{i18n.form_email_label}</label>
			<input
				autofocus
				{...resetPassword.fields.email.as('email')}
				class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner focus:border-sky-400 focus:ring-2 focus:ring-sky-200 focus:outline-none"
			/>
		</div>

		<div class="space-y-2">
			<label class="text-sm font-medium text-slate-700" for="password"
				>{i18n.form_password_label}</label
			>
			<input
				{...resetPassword.fields.password.as('password')}
				class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none"
			/>
		</div>
		{#each resetPassword.fields.allIssues() as issue (issue.message)}
			{#if issue}
				<span class="text-red-500 opacity-80">{issue.message}</span>
			{/if}
		{/each}

		<div class="flex justify-between">
			<button class="btn btn-info" type="button" onclick={() => (forgot = false)}>Back</button>
			<button
				class="btn btn-primary"
				{...resetPassword.buttonProps.enhance(async ({ submit }) => {
					console.log('testing');
					try {
						await submit();
						forgot = false;
					} catch (e) {
						console.error(e);
					}
				})}>Reset</button
			>
		</div>
	</form>
{/if}
