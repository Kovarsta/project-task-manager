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

	const statusColors: Record<string, string> = {
		ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
		ON_HOLD: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
		CANCELED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
		COMPLETE: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
	};

	const tagColors = [
		'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
		'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
		'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
		'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
		'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
		'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
		'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
		'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300'
	];

	function tagColor(index: number) {
		return tagColors[index % tagColors.length];
	}
</script>

<button
	onclick={() => goto(`/projects/${project.id}`)}
	class="w-full rounded-xl border p-4 text-left transition-colors hover:bg-accent"
>
	<div class="flex items-center gap-2">
		<p class="truncate text-sm font-medium">{project.name}</p>
		{#if project.status && project.status !== 'ACTIVE'}
			<span
				class="text-xxs shrink-0 rounded-full px-2 py-0.5 font-medium {statusColors[
					project.status
				] ?? ''}"
			>
				{project.status === 'ON_HOLD'
					? 'Hold'
					: project.status === 'COMPLETE'
						? 'Done'
						: project.status}
			</span>
		{/if}
	</div>
	<p class="mt-1 text-xs text-muted-foreground">
		Task left: {project._count.tasks}
	</p>
	{#if project.tags && project.tags.length > 0}
		<div class="mt-1.5 flex flex-wrap items-center gap-1">
			{#each project.tags.slice(0, 3) as tag, i (tag)}
				<span class="text-xxs rounded-full px-1.5 py-0.5 font-medium {tagColor(i)}">
					{tag}
				</span>
			{/each}
			{#if project.tags.length > 3}
				<span class="text-xxs text-muted-foreground">+{project.tags.length - 3}</span>
			{/if}
		</div>
	{/if}
	{#if (project._myTaskCount ?? 0) > 0}
		<div class="mt-2 flex h-5 items-center gap-1">
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
		<div class="mt-2 flex h-5 items-center">
			<span class="text-xs text-muted-foreground/40"> No tasks assigned </span>
		</div>
	{/if}
</button>
