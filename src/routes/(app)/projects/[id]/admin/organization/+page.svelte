<script lang="ts">
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import NativeSelect from '$lib/components/ui/NativeSelect.svelte';
	import TagInput from '$lib/components/ui/TagInput.svelte';
	import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte';
	import { sanitizeHtml } from '$lib/sanitize';

	let { data } = $props<{
		data: {
			project: {
				name: string;
				status: string;
				description: string | null;
				deadline: string | null;
				tags: string[];
			};
			admins: Array<{
				id: number;
				role: string;
				user: { id: number; name: string; email: string };
			}>;
		};
	}>();
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
	let status = $state(data.project.status);
	let description = $state(data.project.description ?? '');
	let deadline = $state(data.project.deadline ?? '');
	let tags = $state<string[]>(data.project.tags ?? []);
	let saving = $state(false);

	function stripHtml(html: string) {
		return html.replace(/<[^>]*>/g, '').trim();
	}

	const descChars = $derived(stripHtml(description).length);
	let showDeleteConfirm = $state(false);

	$effect(() => {
		name = data.project.name;
		status = data.project.status;
		description = data.project.description ?? '';
		deadline = data.project.deadline ?? '';
		tags = data.project.tags ?? [];
	});

	async function saveSettings() {
		if (!name.trim()) {
			toast.error('Project name is required');
			return;
		}
		saving = true;
		try {
			const res = await fetch(`/api/projects/${projectId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					status,
					description: sanitizeHtml(description.trim()) || null,
					deadline: deadline || null,
					tags
				})
			});

			if (!res.ok) {
				const err = await res.json();
				toast.error(err.message);
				return;
			}

			toast.success('Project settings saved');
			await invalidateAll();
		} finally {
			saving = false;
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

<div class="mb-8 max-w-lg space-y-6">
	<!-- Status -->
	<div>
		<label class="text-sm font-medium">Status</label>
		<div class="mt-1">
			<NativeSelect bind:value={status} class="w-full">
				<option value="ACTIVE">Active</option>
				<option value="ON_HOLD">On Hold</option>
				<option value="CANCELED">Canceled</option>
				<option value="COMPLETE">Complete</option>
			</NativeSelect>
		</div>
	</div>

	<!-- Name -->
	<div>
		<label class="text-sm font-medium">Project Name</label>
		<div class="mt-1">
			<Input bind:value={name} />
		</div>
	</div>

	<!-- Description -->
	<div>
		<label class="text-sm font-medium">Description</label>
		<div class="mt-1">
			<RichTextEditor bind:content={description} placeholder="Describe the project..." />
		</div>
		<p class="mt-1 text-xs {descChars > 60 ? 'text-red-500' : 'text-muted-foreground/60'}">
			{descChars}/60 characters
		</p>
	</div>

	<!-- Deadline -->
	<div>
		<label class="text-sm font-medium">Deadline</label>
		<div class="mt-1">
			<Input type="date" bind:value={deadline} />
		</div>
	</div>

	<!-- Tags -->
	<div>
		<label class="text-sm font-medium">Tags</label>
		<div class="mt-1">
			<TagInput bind:tags />
		</div>
		<p class="mt-1 text-xs text-muted-foreground/60">
			e.g. tag1, tag2, tag3... (press Enter or comma to add) · max 10 tags
		</p>
	</div>

	<!-- Save -->
	<div class="flex gap-2">
		<Button onclick={saveSettings} disabled={saving}>
			{saving ? 'Saving...' : 'Save Settings'}
		</Button>
	</div>
</div>

<!-- Owner transfer -->
<hr class="mb-8 max-w-lg border-t" />

<h3 class="mb-4 text-lg font-semibold">Ownership</h3>
{#if data.admins.length > 0}
	<div class="mb-8 max-w-md">
		<label class="text-sm font-medium">Transfer Ownership</label>
		<p class="mb-2 text-xs text-muted-foreground">
			Transfer the project owner role to another admin.
		</p>
		<div class="mt-1 flex gap-2">
			<div class="flex-1">
				<UserSearchSelect
					bind:value={transferUserId}
					placeholder="Search admins by name or email..."
					members={data.admins}
				/>
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
			<Button
				class="flex-1 bg-purple-500 text-white hover:bg-purple-600"
				onclick={confirmTransfer}
				disabled={transferring}>{transferring ? 'Transferring...' : 'Transfer'}</Button
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
