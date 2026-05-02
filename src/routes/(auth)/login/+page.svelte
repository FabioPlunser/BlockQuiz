<script lang="ts">
	import { page } from '$app/state';
	import { i18n } from '$lib/i18n/index.svelte';
	import { login } from '$remote/auth.remote';
	import { resolve } from '$app/paths';
	import ForgotPassword from '$cp/login/ForgotPassword.svelte';
	import { fly } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { showSuccess, showError } from '$lib/utils/toast';

	const features = $derived([
		i18n.feature_short_focused,
		i18n.feature_blockly_autograding,
		i18n.feature_bilingual_ready
	]);

	let forgot = $state(false);
	let mounted = $state(false);
	let issues = $derived(login.fields.allIssues() ?? []);
	onMount(() => {
		mounted = true;
	});
</script>

<svelte:head>
	<title>{i18n.login_title} | BlockQuiz</title>
</svelte:head>

{#if mounted}
	<section class="flex flex-col gap-12 lg:flex-row lg:items-center">
		<div class="flex-1 space-y-6">
			<p
				class="inline-flex items-center rounded-full bg-sky-100 px-4 py-1 text-sm font-semibold text-sky-700"
			>
				🚀 {i18n.welcome_tagline}
			</p>
			<h1 class="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
				{i18n.welcome_title}
			</h1>
			<p class="text-lg text-slate-600 sm:max-w-xl">
				{i18n.welcome_description}
			</p>
			<ul class="space-y-3 text-base text-slate-700">
				{#each features as feature, i (i)}
					<li
						in:fly={{ x: -200, duration: 500, delay: i * 100 }}
						class="flex items-start gap-3 rounded-2xl bg-white/70 px-4 py-3 shadow-lg"
					>
						<span class="mt-1 text-lg">✨</span>
						<span>{feature}</span>
					</li>
				{/each}
			</ul>
		</div>

		<div class="w-full max-w-md" in:fly={{ duration: 300, y: -200, delay: 200 }}>
			<div class="rounded-3xl bg-white p-8 shadow-xl shadow-purple-200 backdrop-blur">
				{#if forgot}
					<ForgotPassword onClose={() => (forgot = false)} />
				{:else}
					<h2 class="text-2xl font-semibold text-slate-900">{i18n.login_title}</h2>
					<p class="mt-1 text-sm text-slate-500">
						{i18n.login_subtitle}
					</p>

					{#if page.form?.message}
						<p class="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
							{page.form.message}
						</p>
					{/if}

					<form
						id="login-form"
						class="mt-6 space-y-5"
						{...login.enhance(async ({ submit }) => {
							try {
								await submit();
								const loginIssues = login.fields.allIssues() ?? [];
								if (loginIssues.length > 0) {
									showError(loginIssues[0].message);
								} else {
									showSuccess(i18n.toast_login_success);
									goto(resolve('/courses'));
								}
							} catch (e) {
								console.error(e);
								showError(i18n.toast_login_failed);
							}
						})}
					>
						<p class="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
							{i18n.login_account_managed_hint}
						</p>
						<div class="space-y-2">
							<label class="text-sm font-medium text-slate-700" for="email"
								>{i18n.form_email_label}</label
							>
							<input
								id="email"
								{...login.fields.email.as('email')}
								class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner focus:border-sky-400 focus:ring-2 focus:ring-sky-200 focus:outline-none"
							/>
						</div>
						<div class="space-y-2">
							<label class="text-sm font-medium text-slate-700" for="password"
								>{i18n.form_password_label}</label
							>
							<input
								id="password"
								{...login.fields.password.as('password')}
								class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none"
							/>
						</div>
						<div class="flex w-full justify-center">
							<button type="submit" class="btn w-full btn-primary">
								{i18n.login_submit_button}
							</button>
						</div>
						{#each issues as issue (`${issue.path}-${issue.message}`)}
							{#if issue}
								<span class="text-red-500 opacity-80">{issue.message}</span>
							{/if}
						{/each}
					</form>
					<div class="mt-4">
						<button onclick={() => (forgot = true)} class="cursor-pointer text-sm text-slate-600">
							{i18n.form_forgot_password}
						</button>
					</div>

					<div class="mt-6 space-y-4 text-sm text-slate-500">
						<div class="flex items-center gap-3">
							<span class="h-px flex-1 bg-slate-200" aria-hidden="true"></span>
							<span class="text-xs tracking-wide uppercase">{i18n.or}</span>
							<span class="h-px flex-1 bg-slate-200" aria-hidden="true"></span>
						</div>
						<a
							class="flex w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 font-medium text-slate-600 transition hover:border-sky-400 hover:text-sky-600"
							href={resolve('/demo')}
						>
							{i18n.explore_as_guest}
						</a>
					</div>
				{/if}
			</div>
		</div>
	</section>
{/if}
