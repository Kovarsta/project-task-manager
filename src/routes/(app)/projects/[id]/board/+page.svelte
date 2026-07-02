<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import type { Task, Project, ProjectMember } from '$lib/type';
	import { page } from '$app/state';
	import TaskDetailModal from '$lib/components/ui/TaskDetailModal.svelte';
	import CreateTaskModal from '$lib/components/ui/CreateTaskModal.svelte';

	let { data } = $props<{
		data: {
			kanban: { TODO: Task[]; DOING: Task[]; DONE: Task[] };
			project: Project;
		};
	}>();

	const isAdmin = $derived(
		data.project.members?.find((m: ProjectMember) => m.user.id === Number(data.session?.user?.id))
			?.role === 'ADMIN'
	);

	let selectedTask = $state<Task | null>(null);
	let showDetail = $state(false);
	let showCreateTask = $state(false);
	let createDefaultStatus = $state<'TODO' | 'DOING' | 'DONE'>('TODO');

	let draggedTask: Task | null = null;

	const projectId = page.params.id;
	const columns = [
		{ key: 'TODO', label: 'To do' },
		{ key: 'DOING', label: 'Doing' },
		{ key: 'DONE', label: 'Done' }
	] as const;

	const priorityColors: Record<string, string> = {
		LOWEST: 'text-gray-400',
		LOW: 'text-blue-500',
		MEDIUM: 'text-yellow-500',
		HIGH: 'text-orange-500',
		HIGHEST: 'text-red-500'
	};

	function openCreate(status: 'TODO' | 'DOING' | 'DONE') {
		createDefaultStatus = status;
		showCreateTask = true;
	}

	function openTask(task: Task) {
		selectedTask = task;
		showDetail = true;
	}

	function onDragStart(task: Task) {
		draggedTask = task;
	}

	async function onDrop(newStatus: 'TODO' | 'DOING' | 'DONE') {
		if (!draggedTask || draggedTask.status === newStatus) return;

		const task = draggedTask;
		draggedTask = null;

		try {
			const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: newStatus })
			});

			if (!res.ok) {
				const err = await res.json();
				toast.error(err.message);
				return;
			}

			await invalidateAll();
		} catch {
			toast.error('Failed to update task status');
		}
	}
	function getDescriptionPreview(desc: string | null): string {
		if (!desc) return '';
		const plainText = desc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
		const words = plainText.split(' ').filter(Boolean);
		if (words.length > 5) {
			return words.slice(0, 5).join(' ') + '...';
		}
		return plainText;
	}
</script>

<div class="flex h-full gap-4">
	{#each columns as col (col.key)}
		<div
			class="flex min-w-0 flex-1 flex-col rounded-xl bg-muted/40 p-3"
			ondragover={(e) => e.preventDefault()}
			ondrop={() => onDrop(col.key)}
		>
			<h3 class="mb-3 text-lg font-bold">{col.label}</h3>

			<div class="flex flex-1 flex-col gap-2 overflow-y-auto">
				{#each data.kanban[col.key] as task (task.id)}
					<button
						draggable="true"
						ondragstart={() => onDragStart(task)}
						onclick={() => openTask(task)}
						class="cursor-grab rounded-lg border bg-background p-3 text-left transition-shadow hover:shadow-sm active:cursor-grabbing"
					>
						<p class="text-sm font-medium">{task.title}</p>
						{#if task.description}
							<p class="mt-1 text-xs text-muted-foreground">{getDescriptionPreview(task.description)}</p>
						{/if}
						<div class="mt-2 flex items-center justify-between">
							<span class="text-xs font-medium {priorityColors[task.priority]}">
								{task.priority}
							</span>
							{#if task.assignee}
								<span class="text-xs text-muted-foreground">{task.assignee.name}</span>
							{:else}
								<span class="text-xs text-muted-foreground">{'-'}</span>
							{/if}
							{#if task.dueDate}
								<span class="text-xs text-muted-foreground">
									{new Date(task.dueDate).toLocaleDateString()}
								</span>
							{/if}
						</div>
					</button>
				{/each}
			</div>

			{#if isAdmin}
				<button
					onclick={() => openCreate(col.key)}
					class="mt-2 rounded-lg bg-cyan-400 py-1.5 text-sm text-muted-foreground text-white hover:bg-cyan-500"
				>
					+ Create
				</button>
			{/if}
		</div>
	{/each}
</div>

{#if selectedTask}
	<TaskDetailModal
		bind:open={showDetail}
		task={selectedTask}
		projectId={Number(page.params.id)}
		isAdmin={data.isAdmin}
		members={data.project?.members ?? []}
		onUpdate={() => invalidateAll()}
	/>
{/if}

<CreateTaskModal
	bind:open={showCreateTask}
	projectId={Number(projectId)}
	members={data.project?.members ?? []}
	defaultStatus={createDefaultStatus}
	onCreated={() => invalidateAll()}
/>
