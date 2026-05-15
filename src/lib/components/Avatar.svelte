<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';
	import { logoutUser } from '$remote/auth.remote';
	import { User } from '@lucide/svelte';
	import { theme } from '$lib/theme.svelte';
</script>

<div class="dropdown dropdown-center">
	<button
		tabindex="0"
		class="btn btn-circle fill-white text-lg btn-ghost"
		aria-label={i18n.avatar_label}
	>
		<User class="" />
	</button>
	<ul
		tabindex="-1"
		class="dropdown-content menu z-10 w-fit gap-1 rounded-xl {theme.isDark
			? 'bg-black'
			: ''} p-2 shadow-md"
	>
		<li>
			<form {...logoutUser}>
				<button class="cursor-pointer">{i18n.account_logout}</button>
			</form>
		</li>
	</ul>
</div>
