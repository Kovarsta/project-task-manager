<script lang="ts">
	import { goto } from '$app/navigation';

	let { project } = $props<{
		project: {
			id: number;
			name: string;
			_count: { tasks: number };
		};
	}>();
</script>

<button
	onclick={() => goto(`/projects/${project.id}`)}
	class="w-full rounded-xl border p-4 text-left transition-colors hover:bg-accent"
>
	<p class="truncate text-sm font-medium">{project.name}</p>
	<p class="mt-1 text-xs text-muted-foreground">
		Task left: {project._count.tasks}
	</p>
</button>
