<script lang="ts">
	import ClassesAnalyticsList from '$cp/analytics/ClassesAnalyticsList.svelte';
	import ClassAnalytics from '$cp/analytics/ClassAnalytics.svelte';
	import StudentClassAnalytics from '$cp/analytics/StudentClassAnalytics.svelte';

	let selectedClassId = $state<string | null>(null);
	let selectedStudentId = $state<string | null>(null);
</script>

{#if selectedClassId && selectedStudentId}
	<StudentClassAnalytics
		classId={selectedClassId}
		userId={selectedStudentId}
		onBack={() => (selectedStudentId = null)}
	/>
{:else if selectedClassId}
	<ClassAnalytics
		classId={selectedClassId}
		onBack={() => (selectedClassId = null)}
		onSelectStudent={(studentId) => (selectedStudentId = studentId)}
	/>
{:else}
	<ClassesAnalyticsList onSelectClass={(classId) => (selectedClassId = classId)} />
{/if}
