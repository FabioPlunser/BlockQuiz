<script lang="ts">
	import { getCurrentUser } from '$remote/auth.remote';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { i18n } from '$lib/i18n/index.svelte';
	import { Role } from '$lib/roles';

	const user = await getCurrentUser();
	type NavPath = '/courses' | '/cms' | '/users' | '/logs' | '/settings';

	const isAdmin = $derived(user?.role === Role.ADMIN);
	const canManageContent = $derived(
		user?.role === Role.TEACHER || user?.role === Role.ADMIN
	);
	const currentPath = $derived(page.url.pathname);

	const navItems = $derived([
		{ path: '/courses', label: i18n.nav_courses, visible: true },
		{ path: '/cms', label: i18n.nav_cms, visible: canManageContent },
		{ path: '/users', label: i18n.nav_users, visible: isAdmin },
		{ path: '/logs', label: i18n.nav_logs, visible: isAdmin },
		{ path: '/settings', label: i18n.nav_settings, visible: isAdmin }
	] satisfies Array<{ path: NavPath; label: string; visible: boolean }>);
</script>

<div class="tabs-box tabs">
	{#each navItems as item (item.path)}
		{#if item.visible}
			<a
				href={resolve(item.path)}
				class="tab"
				class:tab-active={currentPath.startsWith(item.path)}
				role="tab"
			>
				{item.label}
			</a>
		{/if}
	{/each}
</div>
