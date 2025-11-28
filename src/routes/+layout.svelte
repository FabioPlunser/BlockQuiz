<script lang="ts">
	import '$lib/app.css';
	let { children } = $props();

	import { page } from '$app/state';
	$inspect(page.url);
</script>

{@render children?.()}
