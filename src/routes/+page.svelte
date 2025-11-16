<script lang="ts">
	import { page } from '$app/state';
	import { i18n } from '$lib/i18n/index.svelte';

	const features = [
		i18n.feature_short_focused,
		i18n.feature_blockly_autograding,
		i18n.feature_bilingual_ready
	];

	$inspect(i18n);
</script>

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
			{#each features as feature}
				<li
					class="flex items-start gap-3 rounded-2xl bg-white/70 px-4 py-3 shadow-sm shadow-sky-100"
				>
					<span class="mt-1 text-lg">✨</span>
					<span>{feature}</span>
				</li>
			{/each}
		</ul>
	</div>

	<div class="w-full max-w-md">
		<div class="rounded-3xl bg-white/90 p-8 shadow-2xl shadow-purple-200 backdrop-blur">
			<h2 class="text-2xl font-semibold text-slate-900">{i18n.login_title}</h2>
			<p class="mt-1 text-sm text-slate-500">
				{i18n.login_subtitle}
			</p>

			{#if page.form?.message}
				<p class="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
					{page.form.message}
				</p>
			{/if}

			<form method="POST" class="mt-6 space-y-5" action="?/login">
				<div class="space-y-2">
					<label class="text-sm font-medium text-slate-700" for="email"
						>{i18n.form_email_label}</label
					>
					<input
						class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner focus:border-sky-400 focus:ring-2 focus:ring-sky-200 focus:outline-none"
						id="email"
						name="email"
						type="email"
						autoComplete="email"
						required
						placeholder={i18n.form_email_placeholder}
					/>
				</div>
				<div class="space-y-2">
					<label class="text-sm font-medium text-slate-700" for="password"
						>{i18n.form_password_label}</label
					>
					<input
						class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner focus:border-purple-400 focus:ring-2 focus:ring-purple-200 focus:outline-none"
						id="password"
						name="password"
						type="password"
						autoComplete="current-password"
						required
						placeholder="••••••••"
					/>
				</div>
				<div class="flex items-center justify-between text-sm text-slate-500">
					<label class="inline-flex items-center gap-2">
						<input
							class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
							type="checkbox"
							name="remember"
						/>
						<span>{i18n.form_remember_me}</span>
					</label>
					<a class="font-medium text-sky-600 hover:text-sky-700" href="/reset"
						>{i18n.form_forgot_password}</a
					>
				</div>
				<button
					type="submit"
					class="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-purple-500 to-pink-500 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-sky-200 transition hover:translate-y-0.5 hover:shadow-xl focus:ring-2 focus:ring-sky-300 focus:outline-none"
				>
					{i18n.login_submit_button}
				</button>
			</form>

			<div class="mt-6 space-y-4 text-sm text-slate-500">
				<div class="flex items-center gap-3">
					<span class="h-px flex-1 bg-slate-200" aria-hidden="true"></span>
					<span class="text-xs tracking-wide uppercase">{i18n.or}</span>
					<span class="h-px flex-1 bg-slate-200" aria-hidden="true"></span>
				</div>
				<a
					class="flex w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 font-medium text-slate-600 transition hover:border-sky-400 hover:text-sky-600"
					href="/demo"
				>
					{i18n.explore_as_guest}
				</a>
				<p class="text-xs leading-relaxed">
					{i18n.privacy_notice_prefix}
					<a class="font-medium text-sky-600 hover:text-sky-700" href="/privacy"
						>{i18n.privacy_policy_link}</a
					>. {i18n.privacy_notice_suffix}
				</p>
			</div>
		</div>
	</div>
</section>
