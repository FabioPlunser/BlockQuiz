<script lang="ts">
	import { page } from '$app/state';
	let { data } = $props();
</script>

<h1 cass="text-red-500">{page.error?.message}</h1>
