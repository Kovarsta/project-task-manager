<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Search } from '@lucide/svelte';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import type { Task, Project, ProjectMember } from '$lib/type';
	import { page } from '$app/state';
	import { Input } from '$lib/components/ui/input';
	import { onMount } from 'svelte';
	import TaskDetailModal from '$lib/components/ui/TaskDetailModal.svelte';
	import CreateTaskModal from '$lib/components/ui/CreateTaskModal.svelte';

	let { data } = $props<{
		data: {
			kanban: null;
			project: Project;
			isAdmin: boolean;
			members: ProjectMember[];
		};
	}>();

	const projectId = page.params.id;
	const isAdmin = data.isAdmin;

	let selectedTask = $state<Task | null>(null);
	let showDetail = $state(false);
	let showCreateTask = $state(false);
	let createDefaultStatus = $state<'TODO' | 'DOING' | 'DONE'>('TODO');

	let draggedTask: Task | null = null;

	let columnSearch = $state<Record<'TODO' | 'DOING' | 'DONE', string>>({
		TODO: '',
		DOING: '',
		DONE: ''
	});

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
		const plainText = desc
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
		const words = plainText.split(' ').filter(Boolean);
		if (words.length > 5) {
			return words.slice(0, 5).join(' ') + '...';
		}
		return plainText;
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		const day = String(d.getDate()).padStart(2, '0');
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const year = d.getFullYear();
		return `${day}/${month}/${year}`;
	}

	// --- Lazy column loading ---
	type ColumnState = {
		tasks: Task[];
		page: number;
		loading: boolean;
		hasMore: boolean;
	};

	let columnStates = $state<Record<string, ColumnState>>({
		TODO: { tasks: [], page: 0, loading: false, hasMore: true },
		DOING: { tasks: [], page: 0, loading: false, hasMore: true },
		DONE: { tasks: [], page: 0, loading: false, hasMore: true }
	});

	let sentinelEls = $state<Record<string, HTMLDivElement | null>>({
		TODO: null,
		DOING: null,
		DONE: null
	});

	type ColumnKey = 'TODO' | 'DOING' | 'DONE';

	async function loadPage(status: ColumnKey) {
		const col = columnStates[status];
		if (!col || col.loading || !col.hasMore) return;
		col.loading = true;

		try {
			const nextPage = col.page + 1;
			const params = new URLSearchParams({ status, page: String(nextPage) });
			if (columnSearch[status]) params.set('q', columnSearch[status]);
			const res = await fetch(`/api/projects/${projectId}/kanban?${params}`);
			const json = await res.json();
			const existingIds = new Set(col.tasks.map((t: Task) => t.id));
			const newTasks = (json.tasks as Task[]).filter((t: Task) => !existingIds.has(t.id));
			col.tasks = [...col.tasks, ...newTasks];
			col.page = nextPage;
			col.hasMore = json.meta.hasMore;
		} catch {
			toast.error(`Failed to load ${status} tasks`);
		} finally {
			col.loading = false;
		}
	}

	async function reloadColumn(status: ColumnKey) {
		const col = columnStates[status];
		col.tasks = [];
		col.page = 0;
		col.hasMore = true;
		await loadPage(status);
	}

	let searchTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	function onSearchInput(status: ColumnKey) {
		if (searchTimers[status]) clearTimeout(searchTimers[status]);
		searchTimers[status] = setTimeout(() => reloadColumn(status), 300);
	}

	onMount(() => {
		const observers: IntersectionObserver[] = [];

		for (const status of ['TODO', 'DOING', 'DONE'] as const) {
			const sentinel = sentinelEls[status];
			if (!sentinel) continue;

			const obs = new IntersectionObserver(
				([entry]) => {
					if (entry.isIntersecting) {
						const col = columnStates[status];
						if (col.hasMore && !col.loading) {
							loadPage(status);
						}
					}
				},
				{ rootMargin: '200px' }
			);
			obs.observe(sentinel);
			observers.push(obs);
		}

		return () => {
			for (const obs of observers) obs.disconnect();
		};
	});
</script>

<div class="flex h-full gap-4">
	{#each columns as col (col.key)}
		<div
			class="flex min-w-0 flex-1 flex-col rounded-xl bg-muted/40 p-3"
			role="region"
			aria-label="{col.label} column"
			ondragover={(e) => e.preventDefault()}
			ondrop={() => onDrop(col.key)}
		>
			<h3 class="mb-3 text-lg font-bold">{col.label}</h3>

			<div class="relative mb-3">
				<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					bind:value={columnSearch[col.key]}
					oninput={() => onSearchInput(col.key)}
					placeholder="Search"
					class="pl-9"
					onkeydown={(e: KeyboardEvent) =>
						e.key === ' ' && columnSearch[col.key] === '' && e.preventDefault()}
				/>
			</div>

			<div class="flex flex-1 flex-col gap-2 overflow-y-auto">
				{#each columnStates[col.key].tasks as task (task.id)}
					<button
						draggable="true"
						ondragstart={() => onDragStart(task)}
						onclick={() => openTask(task)}
						class="cursor-grab rounded-lg border bg-background p-3 text-left transition-shadow hover:shadow-sm active:cursor-grabbing"
					>
						<p class="text-sm font-medium">{task.title}</p>
						{#if task.description}
							<p class="mt-1 text-xs text-muted-foreground">
								{getDescriptionPreview(task.description)}
							</p>
						{/if}
						<div class="mt-2 flex flex-col gap-0.5">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium {priorityColors[task.priority]}">
									{task.priority}
								</span>
								{#if task.assignee}
									<span class="text-xs text-muted-foreground">{task.assignee.name}</span>
								{:else}
									<span class="text-xs text-muted-foreground">{'-'}</span>
								{/if}
							</div>
							{#if task.dueDate}
								<span class="text-xs text-muted-foreground">
									{formatDate(task.dueDate)}
								</span>
							{/if}
						</div>
					</button>
				{/each}

				{#if columnStates[col.key].loading}
					<div class="flex justify-center py-4">
						<Loader2Icon class="h-5 w-5 animate-spin text-muted-foreground" />
					</div>
				{/if}

				<div bind:this={sentinelEls[col.key]} class="h-1"></div>
			</div>

			{#if isAdmin}
				<button
					onclick={() => openCreate(col.key)}
					class="mt-2 rounded-lg bg-cyan-400 py-1.5 text-sm text-cyan-950 hover:bg-cyan-500"
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
		members={data.members}
		onUpdate={() => invalidateAll()}
	/>
{/if}

<CreateTaskModal
	bind:open={showCreateTask}
	projectId={Number(projectId)}
	members={data.members}
	defaultStatus={createDefaultStatus}
	onCreated={() => invalidateAll()}
/>
