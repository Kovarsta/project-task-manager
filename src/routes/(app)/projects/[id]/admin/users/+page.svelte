<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { UserPlus, Trash2, X } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import type { ProjectMember, Invite } from '$lib/type';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte';

	let { data } = $props<{
		data: { members: ProjectMember[]; invites: Invite[] };
	}>();

	const projectId = page.params.id;

	let search = $state('');
	let roleFilter = $state('');
	let showInvite = $state(false);
	let inviteEmail = $state('');
	let inviting = $state(false);

	let confirmRemove = $state<ProjectMember | null>(null);
	let showRemoveConfirm = $state(false);

	let pendingInvites = $derived(data.invites.filter((i: Invite) => i.status === 'PENDING'));
	let acceptedMembers = $derived(
		data.members.filter((m: ProjectMember) => {
			const matchSearch =
				m.user.name.toLowerCase().includes(search.toLowerCase()) ||
				m.user.email.toLowerCase().includes(search.toLowerCase());
			const matchRole = !roleFilter || m.role === roleFilter;
			return matchSearch && matchRole;
		})
	);

	const totalMembers = $derived(data.members.length);
	const adminCount = $derived(data.members.filter((m: ProjectMember) => m.role === 'ADMIN').length);

	async function sendInvite() {
		if (!inviteEmail.trim()) {
			toast.error('Email is required');
			return;
		}
		inviting = true;
		try {
			const res = await fetch(`/api/projects/${projectId}/invites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: inviteEmail.trim() })
			});

			if (!res.ok) {
				const err = await res.json();
				toast.error(err.message);
				return;
			}

			toast.success('Invite sent');
			inviteEmail = '';
			showInvite = false;
			invalidateAll();
		} finally {
			inviting = false;
		}
	}

	function askRemove(member: ProjectMember) {
		confirmRemove = member;
		showRemoveConfirm = true;
	}

	async function confirmRemoveMember() {
		if (!confirmRemove) return;
		const res = await fetch(`/api/projects/${projectId}/members/${confirmRemove.user.id}`, {
			method: 'DELETE'
		});

		if (!res.ok) {
			const err = await res.json();
			toast.error(err.message);
			return;
		}

		toast.success('Member removed');
		showRemoveConfirm = false;
		confirmRemove = null;
		invalidateAll();
	}

	async function revokeInvite(inviteId: number) {
		const res = await fetch(`/api/projects/${projectId}/invites/${inviteId}`, {
			method: 'DELETE'
		});

		if (!res.ok) {
			const err = await res.json();
			toast.error(err.message);
			return;
		}

		toast.success('Invite revoked');
		invalidateAll();
	}

	async function changeRole(member: ProjectMember, newRole: 'ADMIN' | 'MEMBER') {
		const res = await fetch(`/api/projects/${projectId}/members/${member.user.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ role: newRole })
		});

		if (!res.ok) {
			const err = await res.json();
			toast.error(err.message);
			return;
		}

		toast.success('Role updated');
		invalidateAll();
	}
</script>

<div class="mb-4 flex items-center justify-between">
	<h2 class="text-xl font-bold">Users</h2>
	<Button
		size="sm"
		class="gap-1 bg-green-500 text-white hover:bg-green-600"
		onclick={() => (showInvite = true)}
	>
		<UserPlus class="h-4 w-4" /> Invite
	</Button>
</div>

<!-- Stats -->
<div class="mb-4 flex gap-3">
	<div class="rounded-xl border px-4 py-2">
		<p class="text-xs text-muted-foreground">Total</p>
		<p class="font-bold">{totalMembers}</p>
	</div>
	<div class="rounded-xl border px-4 py-2">
		<p class="text-xs text-muted-foreground">Admin</p>
		<p class="font-bold">{adminCount}</p>
	</div>
</div>

<!-- Search + filter -->
<div class="mb-4 flex gap-3">
	<Input bind:value={search} placeholder="Search" class="max-w-sm" />
	<select bind:value={roleFilter} class="rounded border px-8 text-sm">
		<option value="">All roles</option>
		<option value="ADMIN">Admin</option>
		<option value="MEMBER">Member</option>
	</select>
</div>

<!-- Table -->
<div class="overflow-hidden rounded-xl border">
	<table class="w-full text-sm">
		<thead class="bg-muted/50">
			<tr>
				<th class="px-4 py-2 text-left">User(s)</th>
				<th class="px-4 py-2 text-left">Role</th>
				<th class="px-4 py-2 text-left">Status</th>
				<th class="w-20 px-4 py-2 text-left">Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each acceptedMembers as member (member.id)}
				<tr class="border-t">
					<td class="px-4 py-2">
						<p class="font-medium">{member.user.name}</p>
						<p class="text-xs text-muted-foreground">{member.user.email}</p>
					</td>
					<td class="px-4 py-2">
						<select
							value={member.role}
							onchange={(e) => changeRole(member, e.currentTarget.value as 'ADMIN' | 'MEMBER')}
							class="rounded border px-2 py-1 pr-6 text-sm"
						>
							<option value="ADMIN">Admin</option>
							<option value="MEMBER">Member</option>
						</select>
					</td>
					<td class="px-4 py-2">Accepted</td>
					<td class="px-4 py-2">
						{#if member.role !== 'ADMIN'}
							<button
								onclick={() => askRemove(member)}
								class="rounded p-1 text-red-500 hover:bg-accent"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						{/if}
					</td>
				</tr>
			{/each}

			{#each pendingInvites as invite (invite.id)}
				<tr class="border-t bg-yellow-50/50">
					<td class="px-4 py-2">
						<p class="font-medium">{invite.invitedEmail}</p>
					</td>
					<td class="px-4 py-2 text-muted-foreground">-</td>
					<td class="px-4 py-2">
						<span class="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">Pending</span>
					</td>
					<td class="px-4 py-2">
						<button
							onclick={() => revokeInvite(invite.id)}
							class="rounded p-1 text-red-500 hover:bg-accent"
						>
							<X class="h-4 w-4" />
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<!-- Invite modal -->
<Dialog.Root bind:open={showInvite}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Invite a member</Dialog.Title>
		</Dialog.Header>
		<UserSearchSelect bind:value={inviteEmail} placeholder="Search by name or email..." />
		<Dialog.Footer>
			<Button class="w-full" onclick={sendInvite} disabled={inviting}>
				{inviting ? 'Sending...' : 'Send Invite'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Remove confirmation -->
<Dialog.Root bind:open={showRemoveConfirm}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Remove this member?</Dialog.Title>
		</Dialog.Header>
		<p class="text-sm text-muted-foreground">
			{confirmRemove?.user.name} will lose access to this project.
		</p>
		<Dialog.Footer class="gap-2">
			<Button variant="outline" class="flex-1" onclick={() => (showRemoveConfirm = false)}
				>Cancel</Button
			>
			<Button class="flex-1 bg-red-500 text-white hover:bg-red-600" onclick={confirmRemoveMember}
				>Remove</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
