<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Trash2, ArrowUp, ArrowDown } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import Pagination from '$lib/components/ui/Pagination.svelte';

	let { data } = $props<{
		data: { projects: any[]; meta: { page: number; limit: number; totalPages: number } };
	}>();

	let search = $state('');
	let confirmDelete: any = $state(null);
	let showConfirm = $state(false);

	let currentPage = $state(data.meta.page);
	let limit = $state(data.meta.limit);

	let sortField = $state<'name' | 'members' | 'tasks'>('name');
	let sortDir = $state<'asc' | 'desc'>('asc');

	function handleSortClick(field: typeof sortField) {
		if (sortField === field) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDir = field === 'name' ? 'asc' : 'desc';
		}
	}

	function reload() {
		goto(`?page=${currentPage}&limit=${limit}`, { keepFocus: true });
	}

	let filtered = $derived.by(() => {
		let result = data.projects.filter((p: any) =>
			p.name.toLowerCase().includes(search.toLowerCase())
		);
		return [...result].sort((a, b) => {
			let cmp = 0;
			if (sortField === 'members') {
				cmp = a._count.members - b._count.members;
			} else if (sortField === 'tasks') {
				cmp = a._count.tasks - b._count.tasks;
			} else {
				cmp = a.name.localeCompare(b.name);
			}
			return sortDir === 'asc' ? cmp : -cmp;
		});
	});

	function askDelete(project: any) {
		confirmDelete = project;
		showConfirm = true;
	}

	async function deleteProject() {
		const res = await fetch(`/api/admin/projects/${confirmDelete.id}`, { method: 'DELETE' });
		if (!res.ok) {
			const err = await res.json();
			toast.error(err.message);
			return;
		}
		toast.success('Project deleted');
		showConfirm = false;
		invalidateAll();
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex-1 overflow-y-auto">
		<div class="mb-4 flex items-center gap-3">
			<Input bind:value={search} placeholder="Search" class="max-w-sm" />
			<div class="flex items-center gap-1">
				<span class="text-xs text-muted-foreground mr-1">Sort by:</span>
				{#each [['name', 'Name'], ['members', 'Members'], ['tasks', 'Tasks']] as [field, label] (field)}
					<Button
						variant={sortField === field ? 'secondary' : 'ghost'}
						size="sm"
						class="gap-1 text-xs h-8"
						onclick={() => handleSortClick(field as any)}
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
						<th class="px-4 py-2 text-left">Name</th>
						<th class="px-4 py-2 text-left">Owner</th>
						<th class="w-20 px-4 py-2 text-left">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as project (project.id)}
						<tr class="border-t">
							<td class="px-4 py-2">{project.name}</td>
							<td class="px-4 py-2 text-muted-foreground">{project.createdBy.email}</td>
							<td class="px-4 py-2">
								<button
									onclick={() => askDelete(project)}
									class="rounded p-1 text-red-500 hover:bg-accent"
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if filtered.length === 0}
			<p class="mt-4 text-sm text-muted-foreground">No projects found</p>
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
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Delete this project?</Dialog.Title>
		</Dialog.Header>
		<p class="text-sm text-muted-foreground">
			This will permanently delete the project and everything in it.
		</p>
		<Dialog.Footer class="gap-2">
			<Button variant="outline" class="flex-1" onclick={() => (showConfirm = false)}>Cancel</Button>
			<Button class="flex-1 bg-red-500 text-white hover:bg-red-600" onclick={deleteProject}
				>Delete</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

