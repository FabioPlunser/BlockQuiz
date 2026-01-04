<script lang="ts">
	import '$lib/app.css';
	import { Toaster } from '$lib/toaster';
	let { children } = $props();
</script>

<Toaster position="bottom-right" />
{@render children?.()}
