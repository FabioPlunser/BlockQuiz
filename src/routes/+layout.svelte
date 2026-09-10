<script lang="ts">
	import '$lib/app.css';
	import { init } from '$lib/i18n/index.svelte';
	import { Toaster } from '$lib/toaster';

	let { children, data }: import('./$types').LayoutProps & { data: { locale: string } } = $props();

	const initializeI18n = () =>
		init({
			initialLocale: data.locale,
			fallbackLocale: 'en'
		});

	await initializeI18n();
</script>

<Toaster position="bottom-right" />
{@render children?.()}
