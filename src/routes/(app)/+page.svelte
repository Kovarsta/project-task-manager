<script lang="ts">
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { Plus, Search, ArrowUp, ArrowDown } from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import ProjectCard from '$lib/components/ui/ProjectCard.svelte';
	import TagInput from '$lib/components/ui/TagInput.svelte';
	import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import type { Project } from '$lib/type.js';
	import { sanitizeHtml } from '$lib/sanitize';
	import Pagination from '$lib/components/ui/Pagination.svelte';

	let { data } = $props();
	let currentPage = $state(data.meta.page);
	let limit = $state(data.meta.limit);
	let errors = $state({ title: false, description: false });
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	let myProjects = $derived<Project[]>(data.myProjects ?? []);
	let sharedProjects = $derived<Project[]>(data.sharedProjects ?? []);
	let search = $state(page.url.searchParams.get('q') ?? '');
	let showCreate = $state(false);
	let newName = $state('');
	let newDescription = $state('');
	let newDeadline = $state('');
	const today = new Date().toLocaleDateString('en-CA');
	let newTags = $state<string[]>([]);
	let creating = $state(false);

	let showConfirmCreateClose = $state(false);

	function hasUnsavedCreate() {
		return newName.trim() || newDescription || newDeadline || newTags.length;
	}

	function onInteractOutsideCreate(e: Event) {
		if (hasUnsavedCreate()) {
			e.preventDefault();
			showConfirmCreateClose = true;
		}
	}

	function onEscapeKeydownCreate(e: KeyboardEvent) {
		if (hasUnsavedCreate()) {
			e.preventDefault();
			showConfirmCreateClose = true;
		}
	}

	function discardCreateAndClose() {
		newName = '';
		newDescription = '';
		newDeadline = '';
		newTags = [];
		showConfirmCreateClose = false;
		showCreate = false;
	}

	function requestCreateClose() {
		if (hasUnsavedCreate()) {
			showConfirmCreateClose = true;
		} else {
			showCreate = false;
		}
	}

	function stripHtml(html: string) {
		return html.replace(/<[^>]*>/g, '').trim();
	}

	function onSearchInput(value: string) {
		search = value;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			currentPage = 1;
			const params = new URLSearchParams({ page: '1', limit: String(limit) });
			if (value) params.set('q', value);
			const tab = page.url.searchParams.get('tab');
			if (tab) params.set('tab', tab);
			goto(`?${params}`, { keepFocus: true, replaceState: true });
		}, 300);
	}

	const descChars = $derived(stripHtml(newDescription).length);

	const STATUS_ORDER: Record<string, number> = {
		ACTIVE: 0,
		ON_HOLD: 1,
		CANCELED: 2,
		COMPLETE: 3
	};

	let sortField = $state<'createdAt' | 'name' | 'tasks' | 'attention' | 'status'>('createdAt');
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
		return [...projects].sort((a, b) => {
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
				} else if (sortField === 'status') {
					cmp = (STATUS_ORDER[a.status ?? 'ACTIVE'] ?? 0) - (STATUS_ORDER[b.status ?? 'ACTIVE'] ?? 0);
				} else {
					cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
				}
				return sortDir === 'asc' ? cmp : -cmp;
			});
	}

	let filteredMy = $derived.by(() => sortProjects(myProjects));
	let filteredShared = $derived.by(() => sortProjects(sharedProjects));

	function reload() {
		const params = new URLSearchParams({ page: String(currentPage), limit: String(limit) });
		const q = page.url.searchParams.get('q');
		const tab = page.url.searchParams.get('tab');
		if (q) params.set('q', q);
		if (tab) params.set('tab', tab);
		goto(`?${params}`, { keepFocus: true });
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
				body: JSON.stringify({
					name: newName.trim(),
					description: sanitizeHtml(newDescription.trim()) || null,
					deadline: newDeadline || null,
					tags: newTags
				})
			});

			if (!res.ok) {
				const err = await res.json();
				toast.error(err.message);
				creating = false;
				return;
			}

			const project = await res.json();
			showCreate = false;
			newName = '';
			newDescription = '';
			newDeadline = '';
			newTags = [];
			creating = false;

			await goto(`/projects/${project.id}`);
		} catch {
			toast.error('Something went wrong');
			creating = false;
		}
	}
</script>

<div class="flex h-full flex-col p-6">
	<div class="flex-1">
		<div class="mb-6 space-y-3">
			<div class="relative">
				<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={search}
					oninput={(e: Event) => onSearchInput((e.target as HTMLInputElement).value)}
					placeholder="Search by name or tags..."
					class="pl-9"
					onkeydown={(e: KeyboardEvent) => e.key === ' ' && search === '' && e.preventDefault()}
				/>
			</div>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-1">
					<span class="mr-1 text-xs text-muted-foreground">Sort by:</span>
					{#each [['createdAt', 'Date'], ['name', 'Name'], ['status', 'Status'], ['tasks', 'Tasks'], ['attention', 'Attention']] as [field, label] (field)}
						<Button
							variant={sortField === field ? 'secondary' : 'ghost'}
							size="sm"
							class="h-8 gap-1 text-xs"
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
		</div>

		{#if activeTab === 'my'}
			<section>
				<h2 class="mb-3 text-sm font-semibold">My Projects</h2>
				{#if filteredMy.length === 0}
					<p class="text-sm text-muted-foreground">No projects found</p>
				{:else}
					<div class="flex flex-col gap-2">
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
					<div class="flex flex-col gap-2">
						{#each filteredShared as project (project.id)}
							<ProjectCard {project} />
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	</div>

	<Pagination
		bind:page={currentPage}
		bind:limit
		totalPages={activeTab === 'my' ? data.meta.myTotalPages : data.meta.sharedTotalPages}
		onChange={reload}
	/>
</div>

<!-- Create Modal -->
<Dialog.Root bind:open={showCreate}>
	<Dialog.Content class="max-w-lg" showCloseButton={false} onInteractOutside={onInteractOutsideCreate} onEscapeKeydown={onEscapeKeydownCreate}>
		<Dialog.Header>
			<div class="flex items-center justify-between">
				<Dialog.Title>Create a new project</Dialog.Title>
				<button type="button" onclick={requestCreateClose} class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
				</button>
			</div>
		</Dialog.Header>
		<div class="space-y-4 py-2">
			<div>
				<label class="mb-1 block text-sm font-medium"
					>Name <span class="text-red-500">*</span></label
				>
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

			<div>
				<label class="mb-1 block text-sm font-medium">Description</label>
				<RichTextEditor bind:content={newDescription} placeholder="Describe the project..." />
				<p class="mt-1 text-xs {descChars > 60 ? 'text-red-500' : 'text-muted-foreground/60'}">
					{descChars}/60 characters
				</p>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium">Deadline</label>
				<Input type="date" bind:value={newDeadline} min={today} />
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium">Tags</label>
				<TagInput bind:tags={newTags} />
				<p class="mt-1 text-xs text-muted-foreground/60">
					e.g. tag1, tag2, tag3... (press Enter or comma to add) · max 10 tags
				</p>
			</div>
		</div>
		<Dialog.Footer>
			<Button class="w-full" disabled={creating} onclick={createProject}>
				{creating ? 'Creating...' : 'Create new project'}
			</Button>
		</Dialog.Footer>

		{#if showConfirmCreateClose}
			<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onclick={() => (showConfirmCreateClose = false)}>
				<div class="mx-4 w-full max-w-sm rounded-xl bg-popover p-6 text-sm shadow-lg ring-1 ring-foreground/10" onclick={(e) => e.stopPropagation()}>
					<h3 class="text-base font-semibold text-foreground">Discard changes?</h3>
					<p class="mt-2 text-muted-foreground">You have unsaved changes. Are you sure you want to discard them?</p>
					<div class="mt-4 flex gap-2">
						<Button variant="outline" class="flex-1" onclick={() => (showConfirmCreateClose = false)}>Keep editing</Button>
						<Button variant="destructive" class="flex-1" onclick={discardCreateAndClose}>Discard</Button>
					</div>
				</div>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
