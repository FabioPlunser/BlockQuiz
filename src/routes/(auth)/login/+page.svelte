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
	import { authClient } from '$lib/client/auth';
	import { getPublicSsoProviders, getPublicAuthSettings } from '$remote/settings.remote';

	const features = $derived([
		i18n.feature_short_focused,
		i18n.feature_blockly_autograding,
		i18n.feature_bilingual_ready
	]);

	let forgot = $state(false);
	let mounted = $state(false);
	let issues = $derived(login.fields.allIssues() ?? []);
	let ssoSubmitting = $state(false);
	let showPasswordLogin = $state(false);
	let ssoProvidersQuery = $derived(getPublicSsoProviders());
	let authSettingsQuery = $derived(getPublicAuthSettings());

	async function signInWithProvider(providerId: string) {
		ssoSubmitting = true;
		try {
			const { error } = await authClient.signIn.sso({
				providerId,
				callbackURL: resolve('/courses')
			});
			if (error) {
				showError(error.message ?? i18n.login_sso_no_provider);
				ssoSubmitting = false;
			}
		} catch (err) {
			console.error(err);
			showError(i18n.login_sso_no_provider);
			ssoSubmitting = false;
		}
	}
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
				class="inline-flex items-center rounded-full bg-primary px-4 py-1 text-sm font-semibold text-primary-content"
			>
				🚀 {i18n.welcome_tagline}
			</p>
			<h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
				{i18n.welcome_title}
			</h1>
			<p class="text-lg text-base-content/70 sm:max-w-xl">
				{i18n.welcome_description}
			</p>
			<ul class="space-y-3 text-base">
				{#each features as feature, i (i)}
					<li
						in:fly={{ x: -200, duration: 500, delay: i * 100 }}
						class="flex items-start gap-3 rounded-2xl border border-base-300 px-4 py-3 shadow-sm backdrop-blur"
					>
						<span class="mt-1 text-lg">✨</span>
						<span>{feature}</span>
					</li>
				{/each}
			</ul>
		</div>

		<div class="w-full max-w-md" in:fly={{ duration: 300, y: -200, delay: 200 }}>
			<div class="rounded-3xl bg-base-200 p-8 shadow-sm backdrop-blur">
				{#if forgot}
					<ForgotPassword bind:forgot />
				{:else}
					<h2 class="text-2xl font-semibold">{i18n.login_title}</h2>
					<p class="mt-1 text-sm">
						{i18n.login_subtitle}
					</p>

					{#if page.form?.message}
						<p class="mt-4 rounded-xl bg-error/10 px-4 py-3 text-sm text-error">
							{page.form.message}
						</p>
					{/if}

					{#snippet ssoLink(providers: { providerId: string; domain: string }[])}
						{#if providers.length === 1}
							<button
								type="button"
								onclick={() => signInWithProvider(providers[0].providerId)}
								disabled={ssoSubmitting}
								class="cursor-pointer text-sm text-base-content/70 disabled:opacity-50"
							>
								{ssoSubmitting ? '…' : i18n.login_sso_submit}
							</button>
						{:else if providers.length > 1}
							<div class="flex flex-col items-start gap-1">
								{#each providers as p (p.providerId)}
									<button
										type="button"
										onclick={() => signInWithProvider(p.providerId)}
										disabled={ssoSubmitting}
										class="cursor-pointer text-sm text-base-content/70 disabled:opacity-50"
									>
										{i18n.login_sso_submit} — {p.domain}
									</button>
								{/each}
							</div>
						{/if}
					{/snippet}

					{#snippet passwordForm()}
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
							<div class="space-y-2">
								<label class="text-sm font-medium" for="email">{i18n.form_email_label}</label>
								<input
									id="email"
									{...login.fields.email.as('email')}
									class="w-full rounded-2xl border border-base-300 bg-base-100 px-4 py-3 shadow-inner focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
								/>
							</div>
							<div class="space-y-2">
								<label class="text-sm font-medium" for="password">{i18n.form_password_label}</label>
								<input
									id="password"
									{...login.fields.password.as('password')}
									class="w-full rounded-2xl border border-base-300 bg-base-100 px-4 py-3 shadow-inner focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
								/>
							</div>
							<div class="flex w-full justify-center">
								<button type="submit" class="btn w-full btn-primary">
									{i18n.login_submit_button}
								</button>
							</div>
							{#each issues as issue (`${issue.path}-${issue.message}`)}
								{#if issue}
									<span class="text-error opacity-80">{issue.message}</span>
								{/if}
							{/each}
						</form>
					{/snippet}

					{#snippet authLinks(providers: { providerId: string; domain: string }[])}
						<div class="mt-4 flex flex-col items-start gap-2">
							<button
								onclick={() => (forgot = true)}
								class="cursor-pointer text-sm text-base-content/70"
							>
								{i18n.form_forgot_password}
							</button>
							{@render ssoLink(providers)}
						</div>
					{/snippet}

					<svelte:boundary>
						{#snippet pending()}{/snippet}
						{#snippet failed()}
							{@render passwordForm()}
							{@render authLinks([])}
						{/snippet}

						{@const providers = await ssoProvidersQuery}
						{@const auth = await authSettingsQuery}
						{@const ssoPrimary = providers.length > 0 && auth.passwordLoginMode === 'fallback'}

						{#if ssoPrimary && !showPasswordLogin}
							<div class="mt-6 space-y-3">
								{#each providers as p (p.providerId)}
									<button
										type="button"
										class="btn w-full btn-primary"
										disabled={ssoSubmitting}
										onclick={() => signInWithProvider(p.providerId)}
									>
										{ssoSubmitting
											? '…'
											: providers.length === 1
												? i18n.login_sso_submit
												: `${i18n.login_sso_submit} — ${p.domain}`}
									</button>
								{/each}
							</div>
							<div class="mt-6 text-center">
								<button
									type="button"
									onclick={() => (showPasswordLogin = true)}
									class="cursor-pointer text-sm text-base-content/70 underline"
								>
									{i18n.login_sso_password_fallback}
								</button>
							</div>
						{:else}
							{@render passwordForm()}
							{@render authLinks(providers)}
						{/if}
					</svelte:boundary>

					<a
						class="mt-6 flex w-full items-center justify-center rounded-2xl border border-dashed border-base-300 bg-base-100 px-4 py-3 text-sm font-medium text-base-content/70 transition hover:border-primary hover:text-primary"
						href={resolve('/demo')}
					>
						{i18n.explore_as_guest}
					</a>
				{/if}
			</div>
		</div>
	</section>
{/if}
