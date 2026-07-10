<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { UserPlus, Trash2, X, Calendar, ListTodo } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import type { ProjectMember, Invite } from '$lib/type';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte';
	import NativeSelect from '$lib/components/ui/NativeSelect.svelte';

	let { data } = $props<{
		data: { members: ProjectMember[]; invites: Invite[] };
	}>();

	const projectId = page.params.id;
	const currentUserId = $derived(Number(page.data.session?.user?.id));

	let search = $state('');
	let roleFilter = $state('');
	let showInvite = $state(false);
	let inviteEmail = $state('');
	let inviting = $state(false);

	let confirmRemove = $state<ProjectMember | null>(null);
	let showRemoveConfirm = $state(false);

	let confirmRole = $state<{ member: ProjectMember; newRole: 'ADMIN' | 'MEMBER' } | null>(null);
	let showRoleConfirm = $state(false);

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
	const adminCount = $derived(
		data.members.filter((m: ProjectMember) => m.role === 'ADMIN' || m.isOwner).length
	);

	async function sendInvite(e: Event) {
		e.preventDefault();
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

	function askRoleChange(member: ProjectMember, newRole: 'ADMIN' | 'MEMBER') {
		if (member.role === 'ADMIN' && newRole === 'MEMBER' && member.user.id !== currentUserId) {
			toast.error('You can only demote yourself');
			return;
		}
		confirmRole = { member, newRole };
		showRoleConfirm = true;
	}

	async function confirmRoleChange() {
		if (!confirmRole) return;
		const { member, newRole } = confirmRole;
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
		showRoleConfirm = false;
		confirmRole = null;
		invalidateAll();
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
	<NativeSelect bind:value={roleFilter}>
		<option value="">All roles</option>
		<option value="ADMIN">Admin</option>
		<option value="MEMBER">Member</option>
	</NativeSelect>
</div>

<!-- Table -->
<div class="overflow-hidden rounded-xl border">
	<table class="w-full text-sm">
		<thead class="bg-muted/50">
			<tr>
				<th class="px-4 py-2 text-left">User</th>
				<th class="w-44 px-4 py-2 text-left">Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each acceptedMembers as member (member.id)}
				<tr class="border-t">
					<td class="px-4 py-3">
						<div class="flex items-center gap-2">
							<span class="font-medium">{member.user.name}</span>
							{#if member.isOwner}
								<span
									class="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700 dark:bg-purple-900 dark:text-purple-300"
									>Owner</span
								>
							{:else if member.role === 'ADMIN'}
								<span
									class="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-300"
									>Admin</span
								>
							{/if}
						</div>
						<div class="text-xs text-muted-foreground">{member.user.email}</div>
						<div class="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
							<div class="flex items-center gap-1">
								<Calendar class="h-3 w-3" />
								Joined {new Date(member.joinedAt).toLocaleDateString('en-US', {
									month: 'short',
									day: 'numeric',
									year: 'numeric'
								})}
							</div>
							<div class="flex items-center gap-1">
								<ListTodo class="h-3 w-3" />
								{member._count?.tasks ?? 0} tasks assigned
							</div>
						</div>
					</td>
					<td class="px-4 py-3">
						<div class="flex flex-col items-start gap-1.5">
							{#if member.isOwner}
								<span class="text-xs text-muted-foreground">Owner — cannot modify</span>
							{:else}
								<NativeSelect
									value={member.role}
									onchange={(e) => {
										const newRole = e.currentTarget.value as 'ADMIN' | 'MEMBER';
										if (newRole !== member.role) {
											askRoleChange(member, newRole);
										}
										e.currentTarget.value = member.role;
									}}
								>
									<option value="ADMIN">Admin</option>
									<option value="MEMBER" disabled={member.role === 'ADMIN' && member.user.id !== currentUserId}>Member</option>
								</NativeSelect>
								{#if member.role !== 'ADMIN'}
									<Button
										variant="outline"
										size="sm"
										class="h-7 text-xs text-red-500 hover:text-red-600"
										onclick={() => askRemove(member)}
									>
										<Trash2 class="h-3 w-3" />
										Remove
									</Button>
								{/if}
							{/if}
						</div>
					</td>
				</tr>
			{/each}

			{#each pendingInvites as invite (invite.id)}
				<tr class="border-t bg-yellow-50/50 dark:bg-yellow-950/20">
					<td class="px-4 py-3">
						<p class="font-medium">{invite.invitedEmail}</p>
						<p class="mt-1 text-xs text-muted-foreground">
							<span
								class="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
								>Pending</span
							>
						</p>
					</td>
					<td class="px-4 py-3">
						<Button
							variant="outline"
							size="sm"
							class="h-7 text-xs text-red-500 hover:text-red-600"
							onclick={() => revokeInvite(invite.id)}
						>
							<X class="h-3 w-3" />
							Revoke
						</Button>
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
		<form onsubmit={sendInvite}>
			<UserSearchSelect bind:value={inviteEmail} placeholder="Search by name or email..." />
			<Dialog.Footer>
				<Button class="w-full" type="submit" disabled={inviting}>
					{inviting ? 'Sending...' : 'Send Invite'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Role change confirmation -->
<Dialog.Root bind:open={showRoleConfirm}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Change member role</Dialog.Title>
			<Dialog.Description>
				{confirmRole?.member.user.name} will be {confirmRole?.newRole === 'ADMIN'
					? 'promoted to'
					: 'demoted to'}
				{confirmRole?.newRole === 'ADMIN' ? 'Admin' : 'Member'}.
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-2 py-2">
			<div class="rounded-lg border bg-muted/30 p-3">
				<div class="font-medium">{confirmRole?.member.user.name}</div>
				<div class="text-xs text-muted-foreground">{confirmRole?.member.user.email}</div>
				<div class="mt-1 text-xs text-muted-foreground">
					Current role: <strong>{confirmRole?.member.role === 'ADMIN' ? 'Admin' : 'Member'}</strong>
					&rarr; New role: <strong>{confirmRole?.newRole === 'ADMIN' ? 'Admin' : 'Member'}</strong>
				</div>
			</div>
			<p class="text-sm text-muted-foreground">
				{confirmRole?.newRole === 'ADMIN'
					? 'Admins can manage project settings, members, and all tasks.'
					: 'Members can view and manage tasks assigned to them.'}
			</p>
		</div>
		<Dialog.Footer class="gap-2">
			<Button
				variant="outline"
				class="flex-1"
				onclick={() => {
					showRoleConfirm = false;
					confirmRole = null;
				}}
			>
				Cancel
			</Button>
			<Button class="flex-1" onclick={confirmRoleChange}>
				{confirmRole?.newRole === 'ADMIN' ? 'Promote' : 'Demote'}
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
