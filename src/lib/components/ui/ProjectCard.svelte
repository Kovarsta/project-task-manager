<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Project } from '$lib/type';

	let {
		project,
		attentionMode = false
	}: {
		project: Project;
		attentionMode?: boolean;
	} = $props();
</script>

<button
	onclick={() => goto(`/projects/${project.id}`)}
	class="w-full rounded-xl border p-4 text-left transition-colors hover:bg-accent"
>
	<p class="truncate text-sm font-medium">{project.name}</p>
	<p class="mt-1 text-xs text-muted-foreground">
		Task left: {project._count.tasks}
	</p>
	{#if (project._myTaskCount ?? 0) > 0}
		<div class="mt-2 flex items-center gap-1 h-5">
			<span class="text-xs font-medium text-orange-600">
				{project._myTaskCount} assigned to you
			</span>
			{#if project._earliestDue}
				<span class="text-xs text-muted-foreground">
					· due {new Date(project._earliestDue).toLocaleDateString()}
				</span>
			{/if}
		</div>
	{:else}
		<div class="mt-2 flex items-center h-5">
			<span class="text-xs text-muted-foreground/40">
				No tasks assigned
			</span>
		</div>
	{/if}
</button>
