<script lang="ts">
	// TODO There is a significant slowdown during modal opening, check on this later
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import type { Task, ProjectMember } from '$lib/type';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte';
	import TagInput from '$lib/components/ui/TagInput.svelte';
	import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte';

	let dueDateInput = $state<HTMLInputElement | null>(null);
	let errors = $state({ title: false, description: false });

	let {
		open = $bindable(),
		task,
		isAdmin,
		projectId,
		members,
		onUpdate
	}: {
		open: boolean;
		projectId: number;
		task: Task;
		isAdmin: boolean;
		members: ProjectMember[];
		onUpdate: () => void;
	} = $props();

	let title = $state(task.title);
	let description = $state(task.description ?? '');
	let tags = $state<string[]>(task.tags ?? []);
	let status = $state(task.status);
	let priority = $state(task.priority);
	let dueDate = $state(task.dueDate?.split('T')[0] ?? '');
	let assigneeId = $state(String(task.assignee?.id ?? ''));
	let saving = $state(false);
	let showDeleteConfirm = $state(false);
	let lastTaskId = $state<number | null>(null);

	$effect(() => {
		if (open && task.id !== lastTaskId) {
			title = task.title;
			description = task.description ?? '';
			tags = task.tags ?? [];
			status = task.status;
			priority = task.priority;
			dueDate = task.dueDate?.split('T')[0] ?? '';
			assigneeId = String(task.assignee?.id ?? '');
			lastTaskId = task.id;
		}
		errors = { title: false, description: false };
	});

	// Strip HTML for plain text length check
	function stripHtml(html: string) {
		return html.replace(/<[^>]*>/g, '').trim();
	}

	async function save() {
		let hasError = false;
		if (!title.trim()) {
			toast.error('Title is required');
			errors.title = true;
			hasError = true;
		}

		const plainDesc = stripHtml(description);
		if (plainDesc.length > 2000) {
			errors.description = true;
			hasError = true;
		}

		if (hasError) {
			toast.error('Please fix the errors above');
			return;
		}

		saving = true;
		try {
			const body: Record<string, unknown> = {
				title: title.trim(),
				description: plainDesc ? description.trim() : null,
				tags,
				status,
				priority,
				dueDate: dueDate || null
			};

			if (isAdmin) {
				body.assigneeId = assigneeId ? Number(assigneeId) : null;
			}

			const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!res.ok) {
				const err = await res.json();
				toast.error(err.message);
				return;
			}

			toast.success('Task updated');
			onUpdate();
		} finally {
			saving = false;
			open = false;
		}
	}

	async function deleteTask() {
		const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, { method: 'DELETE' });
		if (!res.ok) {
			const err = await res.json();
			toast.error(err.message);
			return;
		}
		toast.success('Task deleted');
		showDeleteConfirm = false;
		open = false;
		onUpdate();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Task Details</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-4">
			<!-- Title -->
			<div>
				<label class="mb-1 block text-sm font-medium"
					>Name <span class="text-red-500">*</span></label
				>
				<Input
					bind:value={title}
					disabled={saving}
					class={errors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}
				/>
				{#if errors.title}
					<p class="mt-1 text-xs text-red-500">Title is required</p>
				{/if}
			</div>

			<!-- Description (rich text) -->
			<div>
				<label class="mb-1 block text-sm font-medium">Description</label>
				<RichTextEditor
					bind:content={description}
					disabled={saving}
					placeholder="Describe the task..."
				/>
				{#if errors.description}
					<p class="mt-1 text-xs text-red-500">Description plain text must be under 2000 characters</p>
				{/if}
			</div>

			<!-- Tags -->
			<div>
				<label class="mb-1 block text-sm font-medium">Tags</label>
				<TagInput bind:tags disabled={saving} />
				<p class="mt-1 text-xs text-muted-foreground/60">
					e.g. tag1, tag2, tag3... (press Enter or comma to add) · max 10 tags
				</p>
			</div>

			<!-- Status / Priority -->
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="mb-1 block text-sm font-medium">Status</label>
					<select bind:value={status} class="w-full rounded border px-2 py-1.5 text-sm">
						<option value="TODO">TODO</option>
						<option value="DOING">DOING</option>
						<option value="DONE">DONE</option>
					</select>
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium">Priority</label>
					<select bind:value={priority} class="w-full rounded border px-2 py-1.5 text-sm">
						<option value="LOWEST">Lowest</option>
						<option value="LOW">Low</option>
						<option value="MEDIUM">Medium</option>
						<option value="HIGH">High</option>
						<option value="HIGHEST">Highest</option>
					</select>
				</div>
			</div>

			<!-- Due Date / Assignee -->
			<div class="grid grid-cols-2 gap-3">
				<div onclick={() => dueDateInput?.showPicker?.()} class="cursor-pointer">
					<label class="mb-1 block text-sm font-medium">Due Date</label>
					<Input type="date" bind:value={dueDate} bind:ref={dueDateInput} class="cursor-pointer" />
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium">Assignee</label>
					{#if isAdmin}
						<UserSearchSelect
							bind:value={assigneeId}
							{members}
							placeholder="Search project members..."
						/>
					{:else}
						<Input value={task.assignee?.name ?? 'Unassigned'} disabled />
					{/if}
				</div>
			</div>
		</div>

		<Dialog.Footer class="gap-2">
			<Button
				class="flex-1 bg-cyan-100 text-cyan-900 hover:bg-cyan-200"
				onclick={save}
				disabled={saving}
			>
				{saving ? 'Saving...' : 'Save'}
			</Button>
			{#if isAdmin}
				<Button
					class="flex-1 bg-red-400 text-white hover:bg-red-500"
					onclick={() => (showDeleteConfirm = true)}
				>
					Delete
				</Button>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={showDeleteConfirm}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Delete this task?</Dialog.Title>
		</Dialog.Header>
		<p class="text-sm text-muted-foreground">This action cannot be undone.</p>
		<Dialog.Footer class="gap-2">
			<Button variant="outline" class="flex-1" onclick={() => (showDeleteConfirm = false)}>
				Cancel
			</Button>
			<Button class="flex-1 bg-red-500 text-white hover:bg-red-600" onclick={deleteTask}>
				Delete
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
