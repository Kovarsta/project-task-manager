<script lang="ts">
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { Plus, Search, ArrowUp, ArrowDown } from '@lucide/svelte';
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

	let sortField = $state<'createdAt' | 'name' | 'tasks' | 'attention'>('createdAt');
	let sortDir = $state<'asc' | 'desc'>('desc');

	function handleSortClick(field: typeof sortField) {
		if (sortField === field) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDir = field === 'name' ? 'asc' : 'desc';
		}
	}

	const activeTab = $derived(page.url.searchParams.get('tab') === 'shared' ? 'shared' : 'my');

	function sortProjects(projects: Project[]) {
		return [...projects]
			.filter((p: Project) => p.name.toLowerCase().includes(search.toLowerCase()))
			.sort((a, b) => {
				let cmp = 0;
				if (sortField === 'name') {
					cmp = a.name.localeCompare(b.name);
				} else if (sortField === 'tasks') {
					cmp = a._count.tasks - b._count.tasks;
				} else if (sortField === 'attention') {
					const aCount = a._myTaskCount ?? 0;
					const bCount = b._myTaskCount ?? 0;
					if (aCount !== bCount) {
						cmp = aCount - bCount;
					} else {
						const aDue = a._earliestDue ? new Date(a._earliestDue).getTime() : Infinity;
						const bDue = b._earliestDue ? new Date(b._earliestDue).getTime() : Infinity;
						cmp = bDue - aDue;
					}
				} else {
					cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
				}
				return sortDir === 'asc' ? cmp : -cmp;
			});
	}

	let filteredMy = $derived.by(() => sortProjects(myProjects));
	let filteredShared = $derived.by(() => sortProjects(sharedProjects));

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
		<div class="flex items-center gap-1">
			<span class="text-xs text-muted-foreground mr-1">Sort by:</span>
			{#each [['createdAt', 'Date'], ['name', 'Name'], ['tasks', 'Tasks'], ['attention', 'Attention']] as [field, label] (field)}
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
