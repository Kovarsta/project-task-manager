<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Search, ListTodo, Users, Calendar, ArrowUp, ArrowDown, Ban, CheckCircle } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import type { AdminProject } from '$lib/type';

	let { data } = $props<{
		data: {
			projects: AdminProject[];
			meta: { page: number; limit: number; totalPages: number };
			q: string;
			sort: string;
			order: string;
		};
	}>();

	let search = $state('');
	let currentPage = $state(1);
	let limit = $state(10);
	let confirmAction: { project: AdminProject; action: 'deactivate' | 'reactivate' } | null = $state(null);
	let showConfirm = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let sortField = $state(data.sort);
	let sortDir = $state(data.order as 'asc' | 'desc');

	function statusLabel(s: string) {
		switch (s) {
			case 'ON_HOLD': return 'Hold';
			case 'COMPLETE': return 'Done';
			case 'CANCELED': return 'Canceled';
			default: return s;
		}
	}

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

	function handleSortClick(field: string) {
		const newDir = sortField === field && sortDir === 'asc' ? 'desc' : 'asc';
		const params = new URLSearchParams({ page: String(currentPage), limit: String(limit), sort: field, order: newDir });
		if (search) params.set('q', search);
		goto(`?${params}`, { keepFocus: true, replaceState: true });
	}

	$effect(() => {
		search = data.q;
		currentPage = data.meta.page;
		limit = data.meta.limit;
		sortField = data.sort;
		sortDir = data.order as 'asc' | 'desc';
	});

	function onSearchInput(value: string) {
		search = value;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			currentPage = 1;
			const params = new URLSearchParams({ page: '1', limit: String(limit), sort: sortField, order: sortDir });
			if (value) params.set('q', value);
			goto(`?${params}`, { keepFocus: true, replaceState: true });
		}, 300);
	}

	function clearSearch() {
		search = '';
		currentPage = 1;
		const params = new URLSearchParams({ page: '1', limit: String(limit), sort: sortField, order: sortDir });
		goto(`?${params}`, { keepFocus: true });
	}

	function reload() {
		const params = new URLSearchParams({ page: String(currentPage), limit: String(limit), sort: sortField, order: sortDir });
		if (search) params.set('q', search);
		goto(`?${params}`, { keepFocus: true });
	}

	function shortDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	}

	function askAction(project: AdminProject, action: 'deactivate' | 'reactivate') {
		confirmAction = { project, action };
		showConfirm = true;
	}

	async function performAction() {
		if (!confirmAction) return;
		const { project, action } = confirmAction;
		const res = await fetch(`/api/admin/projects/${project.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action })
		});
		if (!res.ok) {
			const err = await res.json();
			toast.error(err.message);
			return;
		}
		toast.success(action === 'deactivate' ? 'Project deactivated' : 'Project reactivated');
		showConfirm = false;
		confirmAction = null;
		invalidateAll();
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex-1 overflow-y-auto">
		<div class="mb-4 space-y-3">
			<div class="relative">
				<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<input
					type="text"
					placeholder="Search by name, owner, description, tags, or date..."
					value={search}
					oninput={(e) => onSearchInput(e.currentTarget.value)}
					class="w-full rounded-lg border border-input bg-background py-2 pr-4 pl-10 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
				/>
			</div>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-1">
					<span class="mr-1 text-xs text-muted-foreground">Sort by:</span>
					{#each [['name', 'Name'], ['created', 'Created']] as [field, label] (field)}
						<Button
							variant={sortField === field ? 'secondary' : 'ghost'}
							size="sm"
							class="h-8 gap-1 text-xs"
							onclick={() => handleSortClick(field)}
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
				{#if data.q}
					<Button variant="ghost" size="sm" onclick={clearSearch}>Clear</Button>
				{/if}
			</div>
		</div>

		<div class="overflow-hidden rounded-xl border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50">
					<tr>
						<th class="px-4 py-3 text-left font-medium">Project</th>
						<th class="px-4 py-3 text-left font-medium">Status</th>
						<th class="px-4 py-3 text-left font-medium">Owner</th>
						<th class="w-16 px-4 py-3 text-left font-medium">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.projects as project (project.id)}
						<tr class="border-t transition-colors hover:bg-muted/20 {project.deactivatedAt ? 'opacity-50' : ''}">
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									<span class="font-medium">{project.name}</span>
									<span class="text-xs text-muted-foreground">
										{statusLabel(project.status)}
									</span>
								</div>
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
								{#if project.description}
									<div class="mt-1 line-clamp-2 text-xs text-muted-foreground/70 [&_a]:text-blue-500 [&_a]:underline">
										{@html project.description}
									</div>
								{/if}
								{#if project.tags && project.tags.length > 0}
									<div class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
										{#each project.tags.slice(0, 5) as tag, i (tag)}
											<span class="text-xs font-medium {tagColor(i)}">{tag}</span>
										{/each}
										{#if project.tags.length > 5}
											<span class="text-xs text-muted-foreground">+{project.tags.length - 5}</span>
										{/if}
									</div>
								{/if}
							</td>
							<td class="px-4 py-3">
								<span class="text-xs font-semibold {project.deactivatedAt ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}">
									{project.deactivatedAt ? 'Deactivated' : 'Active'}
								</span>
							</td>
							<td class="px-4 py-3">
								<div>{project.createdBy.name}</div>
								<div class="text-xs text-muted-foreground">{project.createdBy.email}</div>
							</td>
							<td class="px-4 py-3">
								{#if project.deactivatedAt}
									<button
										onclick={() => askAction(project, 'reactivate')}
										class="rounded p-1.5 text-green-600 transition-colors hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950"
										title="Reactivate project"
									>
										<CheckCircle class="h-4 w-4" />
									</button>
								{:else}
									<button
										onclick={() => askAction(project, 'deactivate')}
										class="rounded p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
										title="Deactivate project"
									>
										<Ban class="h-4 w-4" />
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if data.projects.length === 0}
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
	{#if confirmAction}
		<Dialog.Content class="max-w-md">
			<Dialog.Header>
				<Dialog.Title>
					{confirmAction.action === 'deactivate' ? 'Deactivate project' : 'Reactivate project'}
				</Dialog.Title>
				<Dialog.Description>
					{confirmAction.action === 'deactivate'
						? 'This will hide the project from all members. You can reactivate it later.'
						: 'This will make the project visible to all members again.'}
				</Dialog.Description>
			</Dialog.Header>

			<div class="space-y-3 py-2">
				<div class="rounded-lg border bg-muted/30 p-4">
					<div class="mb-3 text-lg font-semibold">{confirmAction.project.name}</div>
					<div class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
						<div>
							<div class="text-xs text-muted-foreground">Owner</div>
							<div class="font-medium">{confirmAction.project.createdBy.name}</div>
							<div class="text-xs text-muted-foreground">{confirmAction.project.createdBy.email}</div>
						</div>
						<div>
							<div class="text-xs text-muted-foreground">Status</div>
							<div class="font-medium">{confirmAction.project.status}</div>
						</div>
						<div>
							<div class="text-xs text-muted-foreground">Tasks</div>
							<div class="font-medium">{confirmAction.project._count.tasks}</div>
						</div>
						<div>
							<div class="text-xs text-muted-foreground">Members</div>
							<div class="font-medium">{confirmAction.project._count.members}</div>
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
						confirmAction = null;
					}}
				>
					Cancel
				</Button>
				<Button
					class="flex-1 {confirmAction.action === 'deactivate' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-green-600 text-white hover:bg-green-700'}"
					onclick={performAction}
				>
					{confirmAction.action === 'deactivate' ? 'Deactivate' : 'Reactivate'}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	{/if}
</Dialog.Root>