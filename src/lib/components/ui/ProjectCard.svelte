<script lang="ts">
	import { Calendar, ListTodo } from '@lucide/svelte';
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
		ACTIVE: 'text-green-600 dark:text-green-400',
		ON_HOLD: 'text-amber-600 dark:text-amber-400',
		CANCELED: 'text-red-600 dark:text-red-400',
		COMPLETE: 'text-blue-600 dark:text-blue-400'
	};

	const tagColors = [
		'text-blue-600 dark:text-blue-400',
		'text-purple-600 dark:text-purple-400',
		'text-green-600 dark:text-green-400',
		'text-amber-600 dark:text-amber-400',
		'text-rose-600 dark:text-rose-400',
		'text-cyan-600 dark:text-cyan-400',
		'text-indigo-600 dark:text-indigo-400',
		'text-teal-600 dark:text-teal-400'
	];

	function tagColor(index: number) {
		return tagColors[index % tagColors.length];
	}

	function stripHtml(html: string) {
		return html.replace(/<[^>]*>/g, '').trim();
	}

	function descriptionPreview(html: string | null) {
		if (!html) return null;
		const text = stripHtml(html);
		if (!text) return null;
		if (text.length <= 60) return text;
		return text.slice(0, 60) + '...';
	}

	function isOverdue(dateStr: string | null) {
		if (!dateStr) return false;
		return new Date(dateStr) < new Date();
	}

	function statusLabel(status: string) {
		switch (status) {
			case 'ON_HOLD':
				return 'Hold';
			case 'COMPLETE':
				return 'Done';
			case 'CANCELED':
				return 'Canceled';
			default:
				return status;
		}
	}

	const preview = $derived(descriptionPreview(project.description));
</script>

<button
	onclick={() => goto(`/projects/${project.id}`)}
	class="flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-colors hover:bg-accent"
>
	<!-- Left: main content -->
	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-2">
			<p class="truncate text-xl font-semibold">{project.name}</p>
			{#if project.status}
				<span
					class="text-xs font-semibold {statusColors[
						project.status
					] ?? ''}"
				>
					{statusLabel(project.status)}
				</span>
			{/if}
		</div>

		<p class="mt-1 text-xs {preview ? 'text-muted-foreground' : 'text-muted-foreground/40 italic'}">
			{preview ?? 'No Description'}
		</p>

		<div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
			{#if project.deadline}
				<span
					class="flex items-center gap-1 text-xs {isOverdue(project.deadline)
						? 'font-medium text-red-600'
						: 'text-muted-foreground'}"
				>
					<Calendar class="h-3 w-3" />
					{new Date(project.deadline).toLocaleDateString()}
				</span>
			{:else}
				<span class="flex items-center gap-1 text-xs text-muted-foreground/40 italic">
					<Calendar class="h-3 w-3" />
					No Deadline
				</span>
			{/if}

			{#if project.tags && project.tags.length > 0}
				{#each project.tags as tag, i (tag)}
					<span class="text-xs font-medium {tagColor(i)}">
						{tag}
					</span>
				{/each}
			{:else}
				<span class="text-xs text-muted-foreground/40 italic">No tags</span>
			{/if}
		</div>
	</div>

	<!-- Right: task meta -->
	<div class="shrink-0 text-right">
		<p class="text-sm text-muted-foreground">
			<ListTodo class="mr-0.5 inline h-4 w-4" />
			{project._count.tasks} tasks
		</p>
		{#if (project._myTaskCount ?? 0) > 0}
			<p class="mt-1 text-xs font-medium text-orange-600">
				{project._myTaskCount} assigned
			</p>
			{#if project._earliestDue}
				<p class="text-xxs text-muted-foreground">
					due {new Date(project._earliestDue).toLocaleDateString()}
				</p>
			{/if}
		{/if}
	</div>
</button>
