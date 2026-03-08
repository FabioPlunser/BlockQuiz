<script lang="ts">
	import { page } from '$app/state';
	let { data } = $props();
</script>

<h1 class="text-red-500">{page.error?.message}</h1>
