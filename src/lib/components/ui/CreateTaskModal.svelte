<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte'
	import { invalidateAll } from '$app/navigation';

	let dueDateInput = $state<HTMLInputElement | null>(null);

	let {
		open = $bindable(),
		projectId,
		members,
		defaultStatus = 'TODO',
		onCreated
	} = $props<{
		defaultStatus?: 'TODO' | 'DOING' | 'DONE'
		open: boolean;
		projectId: number;
		members: { id: number; user: { id: number; name: string } }[];
		onCreated: () => void;
	}>();

	let title = $state('');
	let description = $state('');
	let status = $state<'TODO' | 'DOING' | 'DONE'>('TODO');	
	let priority = $state('MEDIUM');
	let dueDate = $state('');
	let assigneeId = $state('');
	let creating = $state(false);

	$effect(() => {
  if (open) {
    status = defaultStatus
  }
})

	async function create() {
		if (!title.trim()) {
			toast.error('Title is required');
			return;
		}
		creating = true;
		try {
			const res = await fetch(`/api/projects/${projectId}/tasks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: title.trim(),
					description: description.trim() || null,
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
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Create Task</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-3">
			<div>
				<label class="text-sm font-medium">Name</label>
				<Input bind:value={title} disabled={creating} />
			</div>

			<div>
				<label class="text-sm font-medium">Description</label>
				<Input bind:value={description} disabled={creating} />
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="text-sm font-medium">Status</label>
					<select bind:value={status} class="w-full rounded border px-2 py-1.5 text-sm">
						<option value="TODO">TODO</option>
						<option value="DOING">DOING</option>
						<option value="DONE">DONE</option>
					</select>
				</div>
				<div>
					<label class="text-sm font-medium">Priority</label>
					<select bind:value={priority} class="w-full rounded border px-2 py-1.5 text-sm">
						<option value="LOWEST">Lowest</option>
						<option value="LOW">Low</option>
						<option value="MEDIUM">Medium</option>
						<option value="HIGH">High</option>
						<option value="HIGHEST">Highest</option>
					</select>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div onclick={() => dueDateInput?.showPicker?.()} class="cursor-pointer">
					<label class="text-sm font-medium">Due Date</label>
					<Input type="date" bind:value={dueDate} bind:ref={dueDateInput} class="cursor-pointer" />
				</div>
				<div>
					<label class="text-sm font-medium">Assignee</label>
				<UserSearchSelect
  bind:value={assigneeId}
  members={members}
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

