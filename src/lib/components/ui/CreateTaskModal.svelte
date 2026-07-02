<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte';
	import TagInput from '$lib/components/ui/TagInput.svelte';
	import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte';
	import { invalidateAll } from '$app/navigation';

	let dueDateInput = $state<HTMLInputElement | null>(null);
	let errors = $state({ title: false, description: false });

	let {
		open = $bindable(),
		projectId,
		members,
		defaultStatus = 'TODO',
		onCreated
	} = $props<{
		defaultStatus?: 'TODO' | 'DOING' | 'DONE';
		open: boolean;
		projectId: number;
		members: { id: number; user: { id: number; name: string } }[];
		onCreated: () => void;
	}>();

	let title = $state('');
	let description = $state('');
	let tags = $state<string[]>([]);
	let status = $state<'TODO' | 'DOING' | 'DONE'>('TODO');
	let priority = $state('MEDIUM');
	let dueDate = $state('');
	let assigneeId = $state('');
	let creating = $state(false);

	$effect(() => {
		if (open) {
			status = defaultStatus;
			errors = { title: false, description: false };
		}
	});

	// Strip HTML tags to get plain text length for validation
	function stripHtml(html: string) {
		return html.replace(/<[^>]*>/g, '').trim();
	}

	async function create() {
		errors = { title: false, description: false };
		let hasError = false;
		if (!title.trim()) {
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

		creating = true;
		try {
			const res = await fetch(`/api/projects/${projectId}/tasks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: title.trim(),
					description: plainDesc ? description.trim() : null,
					tags,
					status,
					priority,
					dueDate: dueDate || null,
					assigneeId: assigneeId || null
				})
			});

			if (!res.ok) {
				const err = await res.json();
				toast.error(err.message);
				return;
			}

			toast.success('Task created');
			title = '';
			description = '';
			tags = [];
			status = 'TODO';
			priority = 'MEDIUM';
			dueDate = '';
			assigneeId = '';
			open = false;
			onCreated();
		} finally {
			creating = false;
		}

		await invalidateAll();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Create Task</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-4">
			<!-- Title -->
			<div>
				<label class="mb-1 block text-sm font-medium"
					>Name <span class="text-red-500">*</span></label
				>
				<Input
					bind:value={title}
					disabled={creating}
					placeholder="Task title..."
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
					disabled={creating}
					placeholder="Describe the task..."
				/>
				{#if errors.description}
					<p class="mt-1 text-xs text-red-500">Description plain text must be under 2000 characters</p>
				{/if}
			</div>

			<!-- Tags -->
			<div>
				<label class="mb-1 block text-sm font-medium">Tags</label>
				<TagInput bind:tags disabled={creating} />
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
					<UserSearchSelect
						bind:value={assigneeId}
						{members}
						placeholder="Search project members..."
					/>
				</div>
			</div>
		</div>

		<Dialog.Footer>
			<Button class="w-full" onclick={create} disabled={creating}>
				{creating ? 'Creating...' : 'Create Task'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
