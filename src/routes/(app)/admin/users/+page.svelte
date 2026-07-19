<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Search, Shield, UserX, UserCheck, ArrowUp, ArrowDown } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Dialog from '$lib/components/ui/dialog';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import type { AdminUser } from '$lib/type';

	let { data } = $props<{
		data: {
			users: AdminUser[];
			meta: { page: number; limit: number; totalPages: number };
			q: string;
			sort: string;
			order: string;
		};
	}>();

	let search = $state('');
	let currentPage = $state(1);
	let limit = $state(10);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	let sortField = $state(data.sort);
	let sortDir = $state(data.order as 'asc' | 'desc');

	let confirmAction: {
		type: 'superAdmin' | 'deactivate' | 'reactivate';
		user: AdminUser;
		newSuperAdmin?: boolean;
	} | null = $state(null);
	let showConfirm = $state(false);
	let processing = $state(false);

	$effect(() => {
		search = data.q;
		currentPage = data.meta.page;
		limit = data.meta.limit;
		sortField = data.sort;
		sortDir = data.order as 'asc' | 'desc';
	});

	function handleSortClick(field: string) {
		const newDir = sortField === field && sortDir === 'asc' ? 'desc' : 'asc';
		const params = new URLSearchParams({ page: String(currentPage), limit: String(limit), sort: field, order: newDir });
		if (search) params.set('q', search);
		goto(`?${params}`, { keepFocus: true, replaceState: true });
	}

	function onSearchInput(value: string) {
		search = value;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			currentPage = 1;
			const params = new URLSearchParams({ page: '1', limit: String(limit), sort: sortField, order: sortDir });
			if (value) params.set('q', value);
			goto(`?${params}`, { keepFocus: true, replaceState: true });
		}, 300);
	}

	function clearSearch() {
		search = '';
		currentPage = 1;
		const params = new URLSearchParams({ page: '1', limit: String(limit), sort: sortField, order: sortDir });
		goto(`?${params}`, { keepFocus: true });
	}

	function reload() {
		const params = new URLSearchParams({ page: String(currentPage), limit: String(limit), sort: sortField, order: sortDir });
		if (search) params.set('q', search);
		goto(`?${params}`, { keepFocus: true });
	}

	function shortDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	}

	function askSuperAdmin(user: AdminUser, makeAdmin: boolean) {
		confirmAction = { type: 'superAdmin', user, newSuperAdmin: makeAdmin };
		showConfirm = true;
	}

	function askDeactivate(user: AdminUser) {
		confirmAction = { type: 'deactivate', user };
		showConfirm = true;
	}

	function askReactivate(user: AdminUser) {
		confirmAction = { type: 'reactivate', user };
		showConfirm = true;
	}

	async function confirmActionHandler() {
		if (!confirmAction) return;
		processing = true;

		const { type, user, newSuperAdmin } = confirmAction;
		const body: Record<string, unknown> = {};

		if (type === 'superAdmin') {
			body.isSuperAdmin = newSuperAdmin;
		} else if (type === 'deactivate') {
			body.deactivatedAt = true;
		} else if (type === 'reactivate') {
			body.deactivatedAt = false;
		}

		const res = await fetch(`/api/admin/users/${user.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		processing = false;

		if (!res.ok) {
			const err = await res.json();
			toast.error(err.message);
			return;
		}

		toast.success(
			type === 'superAdmin'
				? 'Role updated'
				: type === 'deactivate'
					? 'User deactivated'
					: 'User reactivated'
		);
		showConfirm = false;
		confirmAction = null;
		invalidateAll();
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex-1 overflow-y-auto">
		<div class="mb-4 space-y-3">
			<div class="relative">
				<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<input
					type="text"
					placeholder="Search users..."
					value={search}
					oninput={(e) => onSearchInput(e.currentTarget.value)}
					class="w-full rounded-lg border border-input bg-background py-2 pr-4 pl-10 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
				/>
			</div>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-1">
					<span class="mr-1 text-xs text-muted-foreground">Sort by:</span>
					{#each [['name', 'Name'], ['role', 'Role'], ['status', 'Status'], ['created', 'Created']] as [field, label] (field)}
						<Button
							variant={sortField === field ? 'secondary' : 'ghost'}
							size="sm"
							class="h-8 gap-1 text-xs"
							onclick={() => handleSortClick(field)}
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
				{#if data.q}
					<Button variant="ghost" size="sm" onclick={clearSearch}>Clear</Button>
				{/if}
			</div>
		</div>

		<div class="overflow-hidden rounded-xl border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50">
					<tr>
						<th class="px-4 py-3 text-left font-medium">User</th>
						<th class="w-44 px-4 py-3 text-left font-medium">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as user (user.id)}
						<tr
							class="border-t transition-colors hover:bg-muted/20 {user.deactivatedAt
								? 'opacity-50'
								: ''}"
						>
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									<span class="font-medium">{user.name}</span>
									{#if user.isSuperAdmin}
										<Badge
											variant="default"
											class="h-5 gap-1 bg-amber-500 px-1.5 py-0 text-xs text-white"
										>
											<Shield class="h-3 w-3" />
											Super Admin
										</Badge>
									{/if}
								</div>
								<div class="text-xs text-muted-foreground">{user.email}</div>
								<div class="mt-1.5 space-y-0.5 text-xs">
									{#if user.deactivatedAt}
										<span class="text-red-600 dark:text-red-400">Deactivated</span>
									{:else}
										<span class="text-muted-foreground">Active</span>
									{/if}
									<span class="text-muted-foreground">
										&middot; {user._count.createdProjects} projects &middot; {user._count
											.memberships} memberships &middot; Joined {shortDate(user.createdAt)}
									</span>
								</div>
							</td>
							<td class="px-4 py-3">
								<div class="flex flex-col items-start gap-1.5">
									<Button
										variant="outline"
										size="sm"
										class="h-7 text-xs"
										disabled={!!user.deactivatedAt}
										onclick={() => askSuperAdmin(user, !user.isSuperAdmin)}
									>
										{user.isSuperAdmin ? 'Demote' : 'Promote'}
									</Button>
									{#if user.deactivatedAt}
										<Button
											variant="outline"
											size="sm"
											class="h-7 text-xs"
											onclick={() => askReactivate(user)}
										>
											<UserCheck class="h-3 w-3" />
											Reactivate
										</Button>
									{:else}
										<Button
											variant="outline"
											size="sm"
											class="h-7 text-xs text-red-600 hover:text-red-600"
											onclick={() => askDeactivate(user)}
										>
											<UserX class="h-3 w-3" />
											Deactivate
										</Button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if data.users.length === 0}
			<p class="mt-6 text-center text-sm text-muted-foreground">
				{data.q ? `No users matching "${data.q}"` : 'No users found'}
			</p>
		{/if}
	</div>

	<Pagination
		bind:page={currentPage}
		bind:limit
		totalPages={data.meta.totalPages}
		onChange={reload}
	/>
</div>

<Dialog.Root bind:open={showConfirm}>
	{#if confirmAction?.type === 'superAdmin'}
		<Dialog.Content class="max-w-sm">
			<Dialog.Header>
				<Dialog.Title>
					{confirmAction.newSuperAdmin ? 'Promote to super admin' : 'Remove super admin'}
				</Dialog.Title>
				<Dialog.Description>
					{confirmAction.newSuperAdmin
						? 'This user will gain full administrative access to all projects and users.'
						: 'This user will lose all super admin privileges.'}
				</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-2 py-2">
				<div class="rounded-lg border bg-muted/30 p-3">
					<div class="font-medium">{confirmAction.user.name}</div>
					<div class="text-xs text-muted-foreground">{confirmAction.user.email}</div>
					<div class="mt-2 flex gap-3 text-xs text-muted-foreground">
						<span>{confirmAction.user._count.createdProjects} projects</span>
						<span>{confirmAction.user._count.memberships} memberships</span>
						<span>{confirmAction.user._count.createdTasks} tasks</span>
					</div>
				</div>
				<p class="text-sm text-muted-foreground">
					Are you sure you want to change this user's role?
				</p>
			</div>
			<Dialog.Footer class="gap-2">
				<Button
					variant="outline"
					class="flex-1"
					disabled={processing}
					onclick={() => {
						showConfirm = false;
						confirmAction = null;
					}}
				>
					Cancel
				</Button>
				<Button class="flex-1" disabled={processing} onclick={confirmActionHandler}>
					{processing ? 'Updating...' : 'Confirm'}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	{/if}

	{#if confirmAction?.type === 'deactivate'}
		<Dialog.Content class="max-w-sm">
			<Dialog.Header>
				<Dialog.Title>Deactivate user</Dialog.Title>
				<Dialog.Description>
					This user will no longer be able to sign in. Their data and project contributions will be
					preserved.
				</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-2 py-2">
				<div class="rounded-lg border bg-muted/30 p-3">
					<div class="font-medium">{confirmAction.user.name}</div>
					<div class="text-xs text-muted-foreground">{confirmAction.user.email}</div>
					<div class="mt-2 flex gap-3 text-xs text-muted-foreground">
						<span>{confirmAction.user._count.createdProjects} projects</span>
						<span>{confirmAction.user._count.memberships} memberships</span>
						<span>{confirmAction.user._count.createdTasks} tasks</span>
					</div>
				</div>
				<p class="text-sm text-muted-foreground">
					Tasks assigned to this user will remain assigned. Projects they created will continue to
					function normally for other members.
				</p>
			</div>
			<Dialog.Footer class="gap-2">
				<Button
					variant="outline"
					class="flex-1"
					disabled={processing}
					onclick={() => {
						showConfirm = false;
						confirmAction = null;
					}}
				>
					Cancel
				</Button>
				<Button
					class="flex-1 bg-red-600 text-white hover:bg-red-700"
					disabled={processing}
					onclick={confirmActionHandler}
				>
					{processing ? 'Deactivating...' : 'Deactivate'}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	{/if}

	{#if confirmAction?.type === 'reactivate'}
		<Dialog.Content class="max-w-sm">
			<Dialog.Header>
				<Dialog.Title>Reactivate user</Dialog.Title>
				<Dialog.Description>
					This user will be able to sign in again with their existing account.
				</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-2 py-2">
				<div class="rounded-lg border bg-muted/30 p-3">
					<div class="font-medium">{confirmAction.user.name}</div>
					<div class="text-xs text-muted-foreground">{confirmAction.user.email}</div>
				</div>
			</div>
			<Dialog.Footer class="gap-2">
				<Button
					variant="outline"
					class="flex-1"
					disabled={processing}
					onclick={() => {
						showConfirm = false;
						confirmAction = null;
					}}
				>
					Cancel
				</Button>
				<Button class="flex-1" disabled={processing} onclick={confirmActionHandler}>
					{processing ? 'Reactivating...' : 'Reactivate'}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	{/if}
</Dialog.Root>
