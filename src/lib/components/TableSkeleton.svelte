<script lang="ts">
	let { headers }: { headers: string[] } = $props();
</script>

<section class="skeleton rounded-box border border-base-200 bg-base-200 shadow-md">
	<div class="overflow-x-auto">
		<table class="table skeleton">
			<thead>
				<tr>
					{#each headers as head}
						<th class="w-2/6">{head}</th>
					{/each}
				</tr>
			</thead>
			<tbody> </tbody>
		</table>
	</div>
</section>
