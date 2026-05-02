<script lang="ts">
	import { resolve } from '$app/paths';
	import { i18n } from '$lib/i18n/index.svelte';
</script>

<svelte:head>
	<title>{i18n.settings_title} | BlockQuiz</title>
</svelte:head>

<main class="space-y-6 p-4 md:p-6">
	<header class="max-w-3xl">
		<p class="text-sm font-semibold tracking-wide text-primary uppercase">{i18n.nav_settings}</p>
		<h1 class="mt-2 text-3xl font-bold">{i18n.settings_title}</h1>
		<p class="mt-3 text-base-content/70">{i18n.settings_description}</p>
	</header>

	<div class="grid gap-4 lg:grid-cols-2">
		<section
			class="card border border-base-300 bg-base-100 shadow-sm"
			aria-labelledby="settings-account"
		>
			<div class="card-body gap-4">
				<div>
					<p class="text-sm font-semibold text-primary">{i18n.settings_account_kicker}</p>
					<h2 id="settings-account" class="card-title">{i18n.settings_account_title}</h2>
				</div>
				<p class="text-base-content/70">{i18n.settings_account_description}</p>
				<ul class="list-disc space-y-2 ps-5 text-sm text-base-content/80">
					<li>{i18n.settings_account_profile_hint}</li>
					<li>
						{i18n.settings_account_courses_prefix}
						<a class="link link-primary" href={resolve('/courses')}>{i18n.nav_courses}</a>
						{i18n.settings_account_courses_suffix}
					</li>
					<li>
						{i18n.settings_account_users_prefix}
						<a class="link link-primary" href={resolve('/users')}>{i18n.nav_users}</a>
						{i18n.settings_account_users_suffix}
					</li>
				</ul>
			</div>
		</section>

		<section
			class="card border border-base-300 bg-base-100 shadow-sm"
			aria-labelledby="settings-appearance"
		>
			<div class="card-body gap-4">
				<div>
					<p class="text-sm font-semibold text-secondary">{i18n.settings_appearance_kicker}</p>
					<h2 id="settings-appearance" class="card-title">{i18n.settings_appearance_title}</h2>
				</div>
				<p class="text-base-content/70">{i18n.settings_appearance_description}</p>
				<div class="rounded-box bg-base-200 p-4 text-sm text-base-content/80">
					<p class="font-semibold">{i18n.language_select}</p>
					<p class="mt-1">{i18n.settings_language_hint}</p>
				</div>
				<p class="text-sm text-base-content/70">{i18n.settings_theme_hint}</p>
			</div>
		</section>

		<section
			class="card border border-base-300 bg-base-100 shadow-sm"
			aria-labelledby="settings-data"
		>
			<div class="card-body gap-4">
				<div>
					<p class="text-sm font-semibold text-accent">{i18n.settings_data_kicker}</p>
					<h2 id="settings-data" class="card-title">{i18n.settings_data_title}</h2>
				</div>
				<p class="text-base-content/70">{i18n.settings_data_description}</p>
				<ul class="list-disc space-y-2 ps-5 text-sm text-base-content/80">
					<li>{i18n.settings_data_progress_hint}</li>
					<li>
						{i18n.settings_data_privacy_prefix}
						<a class="link link-primary" href={resolve('/privacy')}>{i18n.privacy_policy_link}</a>
						{i18n.settings_data_privacy_suffix}
					</li>
				</ul>
			</div>
		</section>

		<section
			class="card border border-base-300 bg-base-100 shadow-sm"
			aria-labelledby="settings-support"
		>
			<div class="card-body gap-4">
				<div>
					<p class="text-sm font-semibold text-info">{i18n.settings_support_kicker}</p>
					<h2 id="settings-support" class="card-title">{i18n.settings_support_title}</h2>
				</div>
				<p class="text-base-content/70">{i18n.settings_support_description}</p>
				<div class="alert items-start text-sm alert-info">
					<span
						class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold"
						aria-hidden="true"
					>
						i
					</span>
					<div>
						<p class="font-semibold">{i18n.settings_password_title}</p>
						<p>{i18n.settings_password_hint}</p>
					</div>
				</div>
				<p class="text-sm text-base-content/70">
					{i18n.settings_support_admin_prefix}
					<a class="link link-primary" href={resolve('/users')}>{i18n.nav_users}</a>
					{i18n.settings_support_admin_suffix}
				</p>
			</div>
		</section>
	</div>
</main>
