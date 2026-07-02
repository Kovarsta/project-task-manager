<script lang="ts">
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { Plus, Search } from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import ProjectCard from '$lib/components/ui/ProjectCard.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import type { Project } from '$lib/type.js';
	import Pagination from '$lib/components/ui/Pagination.svelte';

	let { data } = $props();
	let currentPage = $state(data.meta.page);
	let limit = $state(data.meta.limit);
	let errors = $state({ title: false, description: false });

	let myProjects = $derived<Project[]>(data.myProjects ?? []);
	let sharedProjects = $derived<Project[]>(data.sharedProjects ?? []);
	let search = $state('');
	let showCreate = $state(false);
	let newName = $state('');
	let creating = $state(false);
	type SortOption = 'createdAt' | 'name' | 'tasks';
	let sortBy = $state<SortOption>('createdAt');

	const activeTab = $derived(page.url.searchParams.get('tab') === 'shared' ? 'shared' : 'my');

	let filteredMy = $derived.by(() => {
		let result = myProjects.filter((p: Project) =>
			p.name.toLowerCase().includes(search.toLowerCase())
		);
		return [...result].sort((a, b) => {
			if (sortBy === 'name') return a.name.localeCompare(b.name);
			if (sortBy === 'tasks') return b._count.tasks - a._count.tasks;
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
	});

	let filteredShared = $derived.by(() => {
		let result = sharedProjects.filter((p: Project) =>
			p.name.toLowerCase().includes(search.toLowerCase())
		);
		return [...result].sort((a, b) => {
			if (sortBy === 'name') return a.name.localeCompare(b.name);
			if (sortBy === 'tasks') return b._count.tasks - a._count.tasks;
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
	});

	function reload() {
		goto(`?page=${currentPage}&limit=${limit}`, { keepFocus: true });
	}

	async function createProject() {
		errors = { title: false, description: false };
		let hasError = false;
		if (!newName.trim()) {
			errors.title = true;
			hasError = true;
		}

		if (hasError) {
			toast.error('Project name is required');
			return;
		}

		creating = true;
		try {
			const res = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newName.trim() })
			});

			if (!res.ok) {
				const err = await res.json();
				toast.error(err.message);
				return;
			}

			showCreate = false;
			newName = '';
			creating = false;
			toast.success('Project created');

			await invalidateAll();
		} catch {
			toast.error('Something went wrong');
			creating = false;
		}
	}
</script>

<div class="p-6">
	<!-- Top bar -->
	<div class="mb-6 flex items-center gap-3">
		<div class="relative max-w-md flex-1">
			<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				bind:value={search}
				placeholder="Search"
				class="pl-9"
				onkeydown={(e: KeyboardEvent) => e.key === ' ' && search === '' && e.preventDefault()}
			/>
		</div>
		<select bind:value={sortBy} class="rounded border px-2 py-1.5 pr-6 text-sm">
			<option value="createdAt">Most Recent</option>
			<option value="name">Name A-Z</option>
			<option value="tasks">Tasks Remaining</option>
		</select>
		<Button
			size="sm"
			class="gap-1 bg-green-500 text-white hover:bg-green-600"
			onclick={() => (showCreate = true)}
		>
			<Plus class="h-4 w-4" /> Create
		</Button>
	</div>

	{#if activeTab === 'my'}
		<section>
			<h2 class="mb-3 text-sm font-semibold">My Projects</h2>
			{#if filteredMy.length === 0}
				<p class="text-sm text-muted-foreground">No projects found</p>
			{:else}
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
					{#each filteredMy as project (project.id)}
						<ProjectCard {project} />
					{/each}
				</div>
			{/if}
		</section>
	{:else}
		<section>
			<h2 class="mb-3 text-sm font-semibold">Shared Projects</h2>
			{#if filteredShared.length === 0}
				<p class="text-sm text-muted-foreground">No shared projects</p>
			{:else}
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
					{#each filteredShared as project (project.id)}
						<ProjectCard {project} />
					{/each}
				</div>
			{/if}
		</section>
	{/if}
	<Pagination
		bind:page={currentPage}
		bind:limit
		totalPages={activeTab === 'my' ? data.meta.myTotalPages : data.meta.sharedTotalPages}
		onChange={reload}
	/>
</div>

<!-- Create Modal -->
<Dialog.Root bind:open={showCreate}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Create a new project</Dialog.Title>
		</Dialog.Header>
		<div class="py-2">
			<Input
				bind:value={newName}
				placeholder="Bakery shop, eventing setup..."
				onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && createProject()}
				class={errors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}
			/>
			{#if errors.title}
				<p class="mt-1 text-xs text-red-500">Project name is required</p>
			{/if}
		</div>
		<Dialog.Footer>
			<Button class="w-full" disabled={creating} onclick={createProject}>
				{creating ? 'Creating...' : 'Create new project'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

