<script lang="ts">
	import { goto } from '$app/navigation';
	import { invalidateAll } from '$app/navigation';
	import { Ellipsis, ArrowUp, ArrowDown, Filter, Search } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import TaskDetailModal from '$lib/components/ui/TaskDetailModal.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import type { Task, Project } from '$lib/type';
	import { formatDate } from '$lib/utils';

	let { data } = $props<{
		data: {
			tasks: Task[];
			meta: { page: number; limit: number; total: number; totalPages: number };
			project: Project;
			isAdmin: boolean;
			query: string;
			sort: string;
			order: 'asc' | 'desc';
		};
	}>();

	const SERVER_SORT_FIELDS: [string, string][] = [
		['createdAt', 'Newest'],
		['title', 'Name'],
		['dueDate', 'Due date'],
		['priority', 'Priority'],
		['status', 'Status']
	];

	const DEFAULT_DIR: Record<string, 'asc' | 'desc'> = {
		createdAt: 'desc',
		title: 'asc',
		dueDate: 'asc',
		priority: 'desc',
		status: 'asc'
	};

	let search = $state(data.query);
	let sortField = $state<string>(data.sort);
	let sortDir = $state<'asc' | 'desc'>(data.order === 'asc' ? 'asc' : 'desc');
	let pageSortField = $state<keyof Task>('title');
	let pageSortDir = $state<'asc' | 'desc'>('asc');

	let selectedTask = $state<Task | null>(null);
	let showDetail = $state(false);

	let currentPage = $state(data.meta.page);
	let limit = $state(data.meta.limit);

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	function buildParams(pageNum: number) {
		let params = `page=${pageNum}&limit=${limit}`;
		if (search.trim()) params += `&q=${encodeURIComponent(search.trim())}`;
		if (sortField !== 'createdAt' || sortDir !== 'desc')
			params += `&sort=${sortField}&order=${sortDir}`;
		return params;
	}

	function submitSearch() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			currentPage = 1;
			goto(`?${buildParams(1)}`, { keepFocus: true });
		}, 300);
	}

	function reload() {
		goto(`?${buildParams(currentPage)}`, { keepFocus: true });
	}

	function handleServerSort(field: string) {
		const newDir =
			sortField === field ? (sortDir === 'asc' ? 'desc' : 'asc') : (DEFAULT_DIR[field] ?? 'asc');
		sortField = field;
		sortDir = newDir;
		currentPage = 1;
		goto(`?${buildParams(1)}`, { keepFocus: true });
	}

	let sorted = $derived.by(() => {
		const result = [...data.tasks];
		result.sort((a, b) => {
			let aVal: string;
			let bVal: string;
			if (pageSortField === 'assignee') {
				aVal = a.assignee?.name ?? '';
				bVal = b.assignee?.name ?? '';
			} else if (pageSortField === 'tags') {
				aVal = (a.tags ?? []).join(', ');
				bVal = (b.tags ?? []).join(', ');
			} else {
				aVal = String(a[pageSortField] ?? '');
				bVal = String(b[pageSortField] ?? '');
			}
			return pageSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
		});
		return result;
	});

	function togglePageSort(field: keyof Task) {
		if (pageSortField === field) {
			pageSortDir = pageSortDir === 'asc' ? 'desc' : 'asc';
		} else {
			pageSortField = field;
			pageSortDir = 'asc';
		}
	}

	function openTask(task: Task) {
		selectedTask = task;
		showDetail = true;
	}

	const priorityColors: Record<string, string> = {
		LOWEST: 'text-gray-400',
		LOW: 'text-blue-500',
		MEDIUM: 'text-yellow-500',
		HIGH: 'text-orange-500',
		HIGHEST: 'text-red-500'
	};

	const tagColors = [
		'bg-blue-100 text-blue-800',
		'bg-purple-100 text-purple-800',
		'bg-green-100 text-green-800',
		'bg-amber-100 text-amber-800',
		'bg-rose-100 text-rose-800',
		'bg-cyan-100 text-cyan-800'
	];

	function tagColor(index: number) {
		return tagColors[index % tagColors.length];
	}

	function getDescriptionPreview(desc: string | null): string {
		if (!desc) return '';
		const plainText = desc
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
		if (plainText.length > 10) {
			return plainText.slice(0, 10) + '...';
		}
		return plainText;
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex-1 overflow-y-auto">
		<!-- Search -->
		<div class="mb-4">
			<div class="relative">
				<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					bind:value={search}
					placeholder="Search by name, assignee, due date, tags..."
					class="pl-9"
					oninput={() => submitSearch()}
					onkeydown={(e: KeyboardEvent) => e.key === ' ' && search === '' && e.preventDefault()}
				/>
			</div>
			<div class="mt-2 flex flex-wrap items-stretch gap-1">
				{#each SERVER_SORT_FIELDS as [field, label] (field)}
					<Button
						variant={sortField === field ? 'secondary' : 'ghost'}
						size="sm"
						class="flex-auto text-xs"
						onclick={() => handleServerSort(field)}
					>
						<Filter class="h-3.5 w-3.5" />
						{label}
						{#if sortField === field}
							{#if sortDir === 'asc'}
								<ArrowUp class="h-3.5 w-3.5" />
							{:else}
								<ArrowDown class="h-3.5 w-3.5" />
							{/if}
						{/if}
					</Button>
				{/each}
			</div>
		</div>

		<!-- Table -->
		<div class="overflow-hidden rounded-xl border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50">
					<tr>
						{#each [['title', 'Name'], ['status', 'Status'], ['priority', 'Priority'], ['dueDate', 'Due date'], ['assignee', 'Assignee'], ['tags', 'Tags']] as [field, label] (field)}
							<th
								class="cursor-pointer px-4 py-2 text-left font-medium select-none"
								onclick={() => togglePageSort(field as keyof Task)}
							>
								<span class="inline-flex items-center gap-1">
									{label}
									{#if pageSortField === field}
										{#if pageSortDir === 'asc'}
											<ArrowUp class="h-3 w-3" />
										{:else}
											<ArrowDown class="h-3 w-3" />
										{/if}
									{/if}
								</span>
							</th>
						{/each}
						<th class="w-10 px-4 py-2"></th>
					</tr>
				</thead>
				<tbody>
					{#each sorted as task (task.id)}
						<tr class="cursor-pointer border-t hover:bg-accent/50" onclick={() => openTask(task)}>
							<td class="max-w-[220px] truncate px-4 py-2">
								<div class="truncate">
									<p class="truncate font-medium">{task.title}</p>
									{#if task.description}
										<!-- Render HTML description as a truncated plain-text preview -->
										<p class="mt-0.5 truncate text-xs text-muted-foreground">
											{getDescriptionPreview(task.description)}
										</p>
									{/if}
								</div>
							</td>
							<td class="px-4 py-2">{task.status}</td>
							<td class="px-4 py-2 font-medium {priorityColors[task.priority]}">{task.priority}</td>
							<td class="px-4 py-2">
								{task.dueDate ? formatDate(task.dueDate) : '-'}
							</td>
							<td class="px-4 py-2 text-muted-foreground">
								{task.assignee?.name ?? '-'}
							</td>
							<td class="px-4 py-2">
								{#if task.tags && task.tags.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each task.tags as tag, i (tag)}
											<span
												class="inline-block rounded-full px-2 py-0.5 text-xs font-medium {tagColor(
													i
												)}"
											>
												{tag}
											</span>
										{/each}
									</div>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</td>
							<td class="px-4 py-2">
								<button onclick={() => openTask(task)} class="rounded p-1 hover:bg-accent">
									<Ellipsis class="h-4 w-4" />
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if sorted.length === 0}
			<p class="mt-4 text-sm text-muted-foreground">No tasks found</p>
		{/if}
	</div>

	<Pagination
		bind:page={currentPage}
		bind:limit
		totalPages={data.meta.totalPages}
		onChange={reload}
	/>
</div>

{#if selectedTask}
	<TaskDetailModal
		bind:open={showDetail}
		task={selectedTask}
		projectId={Number(data.project.id)}
		isAdmin={data.isAdmin}
		members={data.project?.members ?? []}
		onUpdate={() => invalidateAll()}
	/>
{/if}
