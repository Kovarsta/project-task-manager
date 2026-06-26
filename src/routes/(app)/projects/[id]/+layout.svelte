<script lang="ts">
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { ChartColumn, ListTodo, KanbanSquare, MoreHorizontal, Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import CreateTaskModal from '$lib/components/ui/CreateTaskModal.svelte';
	import type { Project, ProjectMember } from '$lib/type';
	import type { Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';

	let showLeaveConfirm = $state(false);
	let leaving = $state(false);

	async function leaveProject() {
		leaving = true;
		try {
			const res = await fetch(`/api/projects/${projectId}/leave`, { method: 'POST' });
			const result = await res.json();

			if (!res.ok) {
				toast.error(result.message);
				return;
			}

			toast.success('Left project');
			goto('/');
		} finally {
			leaving = false;
			showLeaveConfirm = false;
		}
	}

	type SessionUser = {
		id: string;
		email: string;
		name: string;
		isSuperAdmin: boolean;
	};

	let { data, children } = $props<{
		data: { project: Project; session: { user: SessionUser } | null };
		children: Snippet;
	}>();

	const projectId = page.params.id;
	const isAdmin = $derived(
		data.project.members?.find((m: ProjectMember) => m.user.id === Number(data.session?.user?.id))
			?.role === 'ADMIN'
	);

	let showCreateTask = $state(false);

	const tabs = [
		{ label: 'Summary', icon: ChartColumn, path: `/projects/${projectId}` },
		{ label: 'List', icon: ListTodo, path: `/projects/${projectId}/list` },
		{ label: 'Board', icon: KanbanSquare, path: `/projects/${projectId}/board` }
	];
</script>

<div class="flex h-full flex-col">
	<div class="border-b px-6 py-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<h1 class="text-xl font-bold">{data.project.name}</h1>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						<button class="rounded p-1 hover:bg-accent">
							<MoreHorizontal class="h-4 w-4 text-muted-foreground" />
						</button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content>
						{#if isAdmin}
							<DropdownMenu.Item onclick={() => goto(`/projects/${projectId}/admin`)}>
								Administration
							</DropdownMenu.Item>
						{/if}
						<DropdownMenu.Item onclick={() => (showLeaveConfirm = true)}>
							Leave Project
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>

			{#if isAdmin}
				<Button
					size="sm"
					class="gap-1 bg-cyan-400 text-white hover:bg-cyan-500"
					onclick={() => (showCreateTask = true)}
				>
					<Plus class="h-4 w-4" /> Create
				</Button>
			{/if}
		</div>

		<div class="mt-3 flex gap-4">
			{#each tabs as tab (tab.path)}
				{@const Icon = tab.icon}
				{@const active = page.url.pathname === tab.path}
				<button
					onclick={() => goto(tab.path)}
					class="flex items-center gap-1.5 border-b-2 px-1 py-2 text-sm transition-colors
            {active
						? 'border-blue-500 font-medium text-blue-500'
						: 'border-transparent text-muted-foreground hover:text-foreground'}"
				>
					<Icon class="h-4 w-4" />
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		{@render children()}
	</div>
</div>

{#if isAdmin}
	<CreateTaskModal
		bind:open={showCreateTask}
		projectId={Number(projectId)}
		members={data.project.members ?? []}
		onCreated={() => invalidateAll()}
	/>
{/if}

<Dialog.Root bind:open={showLeaveConfirm}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title class="text-red-500">Leave this project?</Dialog.Title>
		</Dialog.Header>
		<p class="text-sm text-muted-foreground">You will lose access to this project and its tasks.</p>
		<Dialog.Footer class="gap-2">
			<Button variant="outline" class="flex-1" onclick={() => (showLeaveConfirm = false)}
				>Cancel</Button
			>
			<Button
				class="flex-1 bg-red-500 text-white hover:bg-red-600"
				onclick={leaveProject}
				disabled={leaving}
			>
				{leaving ? 'Leaving...' : 'Leave'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

