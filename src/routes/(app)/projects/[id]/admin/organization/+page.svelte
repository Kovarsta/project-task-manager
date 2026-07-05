<script lang="ts">
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte';

	let { data } = $props<{ data: { project: { name: string }; admins: Array<{ id: number; role: string; user: { id: number; name: string; email: string } }> } }>();
	const projectId = page.params.id;

	let transferUserId = $state('');
	let transferring = $state(false);
	let showTransferConfirm = $state(false);

	async function confirmTransfer() {
		if (!transferUserId) return;
		transferring = true;
		try {
			const res = await fetch(`/api/projects/${projectId}/transfer-owner`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: Number(transferUserId) })
			});
			if (!res.ok) {
				const err = await res.json();
				toast.error(err.message);
				return;
			}
			toast.success('Ownership transferred');
			await invalidateAll();
		} finally {
			transferring = false;
			showTransferConfirm = false;
		}
	}

	let name = $state(data.project.name);
	let renaming = $state(false);
	let showDeleteConfirm = $state(false);

	async function rename() {
		if (!name.trim()) {
			toast.error('Project name is required');
			return;
		}
		renaming = true;
		try {
			const res = await fetch(`/api/projects/${projectId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: name.trim() })
			});

			if (!res.ok) {
				const err = await res.json();
				toast.error(err.message);
				return;
			}

			toast.success('Project renamed');
		} finally {
			renaming = false;
		}
	}

	async function deleteProject() {
		const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
		if (!res.ok) {
			const err = await res.json();
			toast.error(err.message);
			return;
		}
		toast.success('Project deleted');
		goto('/');
	}
</script>

<h2 class="mb-6 text-xl font-bold">Organization</h2>

<!-- Owner transfer -->
{#if data.admins.length > 0}
	<div class="mb-8 max-w-md">
		<label class="text-sm font-medium">Transfer Ownership</label>
		<p class="mb-2 text-xs text-muted-foreground">Transfer the project owner role to another admin.</p>
		<div class="mt-1 flex gap-2">
			<div class="flex-1">
				<UserSearchSelect bind:value={transferUserId} placeholder="Search admins by name or email..." members={data.admins} />
			</div>
			<Button
				class="bg-purple-500 text-white hover:bg-purple-600"
				disabled={!transferUserId}
				onclick={() => (showTransferConfirm = true)}
			>
				Transfer
			</Button>
		</div>
	</div>
{:else}
	<div class="mb-8 max-w-md">
		<p class="text-sm text-muted-foreground">No other admins to transfer ownership to.</p>
	</div>
{/if}

<div class="mb-8 max-w-md">
	<label class="text-sm font-medium">Rename Project</label>
	<div class="mt-1 flex gap-2">
		<Input bind:value={name} disabled={renaming} />
		<Button class="bg-green-500 text-white hover:bg-green-600" onclick={rename} disabled={renaming}>
			Rename
		</Button>
	</div>
</div>

<div class="max-w-md">
	<p class="mb-2 text-sm font-medium text-red-500">Danger zone</p>
	<Button
		class="w-full bg-red-400 text-white hover:bg-red-500"
		onclick={() => (showDeleteConfirm = true)}
	>
		Delete Project
	</Button>
</div>

<!-- Transfer ownership confirmation -->
<Dialog.Root bind:open={showTransferConfirm}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Transfer ownership?</Dialog.Title>
		</Dialog.Header>
		<p class="text-sm text-muted-foreground">
			You will no longer be the project owner. This action cannot be undone.
		</p>
		<Dialog.Footer class="gap-2">
			<Button variant="outline" class="flex-1" onclick={() => (showTransferConfirm = false)}
				>Cancel</Button
			>
			<Button class="flex-1 bg-purple-500 text-white hover:bg-purple-600" onclick={confirmTransfer} disabled={transferring}
				>{transferring ? 'Transferring...' : 'Transfer'}</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={showDeleteConfirm}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Delete this project?</Dialog.Title>
		</Dialog.Header>
		<p class="text-sm text-muted-foreground">
			This will permanently delete the project, all tasks, members, and invites. This cannot be
			undone.
		</p>
		<Dialog.Footer class="gap-2">
			<Button variant="outline" class="flex-1" onclick={() => (showDeleteConfirm = false)}
				>Cancel</Button
			>
			<Button class="flex-1 bg-red-500 text-white hover:bg-red-600" onclick={deleteProject}
				>Delete</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
