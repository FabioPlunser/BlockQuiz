<script lang="ts">
	import { getCurrentUser } from '$remote/auth.remote';
	import { page } from '$app/state';
	import { i18n } from '$lib/i18n/index.svelte';

	const user = await getCurrentUser();

	const isAdmin = $derived(user?.role === 'admin');
	const currentPath = $derived(page.url.pathname);

	const navItems = $derived([
		{ path: '/courses', label: i18n.nav_courses, visible: true },
		{ path: '/cms', label: i18n.nav_cms, visible: isAdmin },
		{ path: '/users', label: i18n.nav_users, visible: isAdmin },
		{ path: '/logs', label: 'Logs', visible: isAdmin },
		{ path: '/settings', label: i18n.nav_settings, visible: isAdmin }
	]);
	$inspect(currentPath);
</script>

<div class="tabs-box tabs">
	{#each navItems as item}
		{#if item.visible}
			<a
				href={item.path}
				class="tab"
				class:tab-active={currentPath.startsWith(item.path)}
				role="tab"
			>
				{item.label}
			</a>
		{/if}
	{/each}
</div>
