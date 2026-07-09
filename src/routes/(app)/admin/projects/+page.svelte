<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Trash2, Search, ListTodo, Users, Calendar, ArrowUp, ArrowDown } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import type { AdminProject } from '$lib/type';

	let { data } = $props<{
		data: {
			projects: AdminProject[];
			meta: { page: number; limit: number; totalPages: number };
			q: string;
		};
	}>();

	let search = $state(data.q);
	let currentPage = $state(data.meta.page);
	let limit = $state(data.meta.limit);
	let confirmDelete: AdminProject | null = $state(null);
	let showConfirm = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let sortField = $state<'name' | 'tasks' | 'members' | 'created'>('name');
	let sortDir = $state<'asc' | 'desc'>('asc');

	function handleSortClick(field: typeof sortField) {
		if (sortField === field) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDir = 'asc';
		}
	}

	let sorted = $derived.by(() => {
		return [...data.projects].sort((a, b) => {
			let cmp = 0;
			if (sortField === 'name') {
				cmp = a.name.localeCompare(b.name);
			} else if (sortField === 'tasks') {
				cmp = a._count.tasks - b._count.tasks;
			} else if (sortField === 'members') {
				cmp = a._count.members - b._count.members;
			} else if (sortField === 'created') {
				cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
			}
			return sortDir === 'asc' ? cmp : -cmp;
		});
	});

	$effect(() => {
		search = data.q;
		currentPage = data.meta.page;
		limit = data.meta.limit;
	});

	function onSearchInput(value: string) {
		search = value;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			currentPage = 1;
			const params = new URLSearchParams({ page: '1', limit: String(limit) });
			if (value) params.set('q', value);
			goto(`?${params}`, { keepFocus: true, replaceState: true });
		}, 300);
	}

	function clearSearch() {
		search = '';
		currentPage = 1;
		const params = new URLSearchParams({ page: '1', limit: String(limit) });
		goto(`?${params}`, { keepFocus: true });
	}

	function reload() {
		const params = new URLSearchParams({ page: String(currentPage), limit: String(limit) });
		if (search) params.set('q', search);
		goto(`?${params}`, { keepFocus: true });
	}

	function shortDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	}

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function askDelete(project: AdminProject) {
		confirmDelete = project;
		showConfirm = true;
	}

	async function deleteProject() {
		if (!confirmDelete) return;
		const res = await fetch(`/api/admin/projects/${confirmDelete.id}`, { method: 'DELETE' });
		if (!res.ok) {
			const err = await res.json();
			toast.error(err.message);
			return;
		}
		toast.success('Project deleted');
		showConfirm = false;
		confirmDelete = null;
		invalidateAll();
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex-1 overflow-y-auto">
		<div class="mb-4 flex items-center gap-3">
			<div class="relative max-w-sm flex-1">
				<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<input
					type="text"
					placeholder="Search projects..."
					value={search}
					oninput={(e) => onSearchInput(e.currentTarget.value)}
					class="w-full rounded-lg border border-input bg-background py-2 pr-4 pl-10 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
				/>
			</div>
			{#if data.q}
				<Button variant="ghost" size="sm" onclick={clearSearch}>Clear</Button>
			{/if}
			<div class="flex items-center gap-1">
				<span class="mr-1 text-xs text-muted-foreground">Sort by:</span>
				{#each [['name', 'Name'], ['tasks', 'Tasks'], ['members', 'Members'], ['created', 'Created']] as [field, label] (field)}
					<Button
						variant={sortField === field ? 'secondary' : 'ghost'}
						size="sm"
						class="h-8 gap-1 text-xs"
						onclick={() => handleSortClick(field as typeof sortField)}
					>
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

		<div class="overflow-hidden rounded-xl border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50">
					<tr>
						<th class="px-4 py-3 text-left font-medium">Project</th>
						<th class="px-4 py-3 text-left font-medium">Owner</th>
						<th class="w-16 px-4 py-3 text-left font-medium">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each sorted as project (project.id)}
						<tr class="border-t transition-colors hover:bg-muted/20">
							<td class="px-4 py-3">
								<div class="font-medium">{project.name}</div>
								<div class="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
									<span class="flex items-center gap-1">
										<ListTodo class="h-3 w-3" />
										{project._count.tasks} tasks
									</span>
									<span class="flex items-center gap-1">
										<Users class="h-3 w-3" />
										{project._count.members} members
									</span>
									<span class="flex items-center gap-1">
										<Calendar class="h-3 w-3" />
										{shortDate(project.createdAt)}
									</span>
								</div>
							</td>
							<td class="px-4 py-3">
								<div>{project.createdBy.name}</div>
								<div class="text-xs text-muted-foreground">{project.createdBy.email}</div>
							</td>
							<td class="px-4 py-3">
								<button
									onclick={() => askDelete(project)}
									class="rounded p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
									title="Delete project"
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if sorted.length === 0}
			<p class="mt-6 text-center text-sm text-muted-foreground">
				{data.q ? `No projects matching "${data.q}"` : 'No projects found'}
			</p>
		{/if}
	</div>

	<Pagination
		bind:page={currentPage}
		bind:limit
		totalPages={data.meta.totalPages}
		onChange={reload}
	/>
</div>

<Dialog.Root bind:open={showConfirm}>
	{#if confirmDelete}
		<Dialog.Content class="max-w-md">
			<Dialog.Header>
				<Dialog.Title>Delete project</Dialog.Title>
				<Dialog.Description>
					This action cannot be undone. All tasks and project data will be permanently deleted.
				</Dialog.Description>
			</Dialog.Header>

			<div class="space-y-3 py-2">
				<div class="rounded-lg border bg-muted/30 p-4">
					<div class="mb-3 text-lg font-semibold">{confirmDelete.name}</div>
					<div class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
						<div>
							<div class="text-xs text-muted-foreground">Owner</div>
							<div class="font-medium">{confirmDelete.createdBy.name}</div>
							<div class="text-xs text-muted-foreground">{confirmDelete.createdBy.email}</div>
						</div>
						<div>
							<div class="text-xs text-muted-foreground">Created</div>
							<div class="font-medium">{formatDate(confirmDelete.createdAt)}</div>
						</div>
						<div>
							<div class="text-xs text-muted-foreground">Tasks</div>
							<div class="font-medium">{confirmDelete._count.tasks}</div>
						</div>
						<div>
							<div class="text-xs text-muted-foreground">Members</div>
							<div class="font-medium">{confirmDelete._count.members}</div>
						</div>
					</div>
				</div>
			</div>

			<Dialog.Footer class="gap-2">
				<Button
					variant="outline"
					class="flex-1"
					onclick={() => {
						showConfirm = false;
						confirmDelete = null;
					}}
				>
					Cancel
				</Button>
				<Button class="flex-1 bg-red-600 text-white hover:bg-red-700" onclick={deleteProject}
					>Delete</Button
				>
			</Dialog.Footer>
		</Dialog.Content>
	{/if}
</Dialog.Root>
