<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Trash2 } from '@lucide/svelte';
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

	type AdminSort = 'name' | 'members' | 'tasks';
	let sortBy = $state<AdminSort>('name');

	function reload() {
		goto(`?page=${currentPage}&limit=${limit}`, { keepFocus: true });
	}

	let filtered = $derived.by(() => {
		let result = data.projects.filter((p: any) =>
			p.name.toLowerCase().includes(search.toLowerCase())
		);
		return [...result].sort((a, b) => {
			if (sortBy === 'members') return b._count.members - a._count.members;
			if (sortBy === 'tasks') return b._count.tasks - a._count.tasks;
			return a.name.localeCompare(b.name);
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
		<Input bind:value={search} placeholder="Search" class="mb-4 max-w-sm" />
		<select bind:value={sortBy} class="rounded border px-2 py-1.5 pr-6 text-sm">
			<option value="name">Name A-Z</option>
			<option value="members">Most Members</option>
			<option value="tasks">Most Tasks</option>
		</select>

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

