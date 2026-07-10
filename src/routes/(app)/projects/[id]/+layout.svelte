<script lang="ts">
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import {
		ChartColumn,
		ListTodo,
		KanbanSquare,
		History,
		MoreHorizontal,
		Plus,
		Calendar
	} from '@lucide/svelte';
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

	const statusColors: Record<string, string> = {
		ACTIVE: 'text-green-600 dark:text-green-400',
		ON_HOLD: 'text-amber-600 dark:text-amber-400',
		CANCELED: 'text-red-600 dark:text-red-400',
		COMPLETE: 'text-blue-600 dark:text-blue-400'
	};

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

	function isOverdue(dateStr: string | null) {
		if (!dateStr) return false;
		return new Date(dateStr) < new Date();
	}

	function daysRemaining(dateStr: string) {
		const now = new Date();
		const target = new Date(dateStr);
		const diff = target.getTime() - now.getTime();
		return Math.ceil(diff / 86400000);
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
	const isOwner = $derived(
		data.project.members?.find((m: ProjectMember) => m.user.id === Number(data.session?.user?.id))
			?.isOwner === true
	);
	const isAdmin = $derived(
		data.project.members?.find((m: ProjectMember) => m.user.id === Number(data.session?.user?.id))
			?.role === 'ADMIN' || isOwner
	);

	let showCreateTask = $state(false);

	const tabs = [
		{ label: 'Summary', icon: ChartColumn, path: `/projects/${projectId}` },
		{ label: 'List', icon: ListTodo, path: `/projects/${projectId}/list` },
		{ label: 'Board', icon: KanbanSquare, path: `/projects/${projectId}/board` },
		{ label: 'Activity', icon: History, path: `/projects/${projectId}/activity` }
	];
</script>

<div class="flex h-full flex-col">
	<div class="border-b px-6 py-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<h1 class="text-xl font-bold">{data.project.name}</h1>
				{#if data.project.status}
					<span
						class="text-sm font-semibold {statusColors[
							data.project.status
						] ?? ''}"
					>
						{data.project.status === 'ON_HOLD'
							? 'On Hold'
							: data.project.status.charAt(0) + data.project.status.slice(1).toLowerCase()}
					</span>
				{/if}
				{#if data.project.deadline}
					{@const remaining = daysRemaining(data.project.deadline)}
					<span
						class="flex items-center gap-1 text-xs {remaining <= 0
							? 'font-medium text-red-600'
							: remaining <= 2
								? 'font-medium text-amber-600'
								: 'text-muted-foreground'}"
					>
						<Calendar class="h-3.5 w-3.5" />
						{new Date(data.project.deadline).toLocaleDateString('en-GB')}
						- {remaining < 0 ? 'Overdue' : remaining === 0 ? 'Due today' : `${remaining}d left`}
					</span>
				{/if}
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

		{#if data.project.tags && data.project.tags.length > 0}
			<div class="mt-2 flex flex-wrap items-center gap-x-2">
				{#each data.project.tags as tag, i (tag)}
					<span class="text-xs font-medium {tagColor(i)}">
						{tag}
					</span>
				{/each}
			</div>
		{/if}

		{#if data.project.description}
			<div class="mt-2 text-sm text-muted-foreground [&_a]:text-blue-500 [&_a]:underline">
				{@html data.project.description}
			</div>
		{/if}

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
