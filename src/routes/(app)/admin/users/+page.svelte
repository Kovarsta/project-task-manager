<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Search, Shield, UserX, UserCheck, ArrowUp, ArrowDown, Filter } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
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
			role: '' | 'super' | 'user';
		};
	}>();

	let search = $state('');
	let currentPage = $state(1);
	let limit = $state(10);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	let sortField = $state(data.sort);
	let sortDir = $state(data.order as 'asc' | 'desc');

	let roleFilter = $state<'all' | 'super' | 'user'>(data.role || 'all');

	let pageSortField = $state<'name' | 'role' | 'status' | 'created'>('name');
	let pageSortDir = $state<'asc' | 'desc'>('asc');

	const sortedUsers = $derived.by(() => {
		const result = [...data.users];
		result.sort((a, b) => {
			let aVal: string;
			let bVal: string;
			if (pageSortField === 'role') {
				aVal = a.isSuperAdmin ? '1' : '0';
				bVal = b.isSuperAdmin ? '1' : '0';
			} else if (pageSortField === 'status') {
				aVal = a.deactivatedAt ? '1' : '0';
				bVal = b.deactivatedAt ? '1' : '0';
			} else if (pageSortField === 'created') {
				aVal = new Date(a.createdAt).getTime().toString();
				bVal = new Date(b.createdAt).getTime().toString();
			} else {
				aVal = String((a as Record<string, unknown>)[pageSortField] ?? '');
				bVal = String((b as Record<string, unknown>)[pageSortField] ?? '');
			}
			return pageSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
		});
		return result;
	});

	function togglePageSort(field: 'name' | 'role' | 'status' | 'created') {
		if (pageSortField === field) {
			pageSortDir = pageSortDir === 'asc' ? 'desc' : 'asc';
		} else {
			pageSortField = field;
			pageSortDir = 'asc';
		}
	}

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
		roleFilter = data.role || 'all';
	});

	function handleSortClick(field: string) {
		const newDir = sortField === field && sortDir === 'asc' ? 'desc' : 'asc';
		const params = new URLSearchParams({
			page: String(currentPage),
			limit: String(limit),
			sort: field,
			order: newDir
		});
		if (search) params.set('q', search);
		if (roleFilter !== 'all') params.set('role', roleFilter);
		goto(`?${params}`, { keepFocus: true, replaceState: true });
	}

	function onSearchInput(value: string) {
		search = value;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			currentPage = 1;
			const params = new URLSearchParams({
				page: '1',
				limit: String(limit),
				sort: sortField,
				order: sortDir
			});
			if (value) params.set('q', value);
			if (roleFilter !== 'all') params.set('role', roleFilter);
			goto(`?${params}`, { keepFocus: true, replaceState: true });
		}, 300);
	}

	function clearSearch() {
		search = '';
		currentPage = 1;
		const params = new URLSearchParams({
			page: '1',
			limit: String(limit),
			sort: sortField,
			order: sortDir
		});
		if (roleFilter !== 'all') params.set('role', roleFilter);
		goto(`?${params}`, { keepFocus: true });
	}

	function reload() {
		const params = new URLSearchParams({
			page: String(currentPage),
			limit: String(limit),
			sort: sortField,
			order: sortDir
		});
		if (search) params.set('q', search);
		if (roleFilter !== 'all') params.set('role', roleFilter);
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
				<Input
					type="text"
					placeholder="Search by name, email, status, or role..."
					value={search}
					oninput={(e) => onSearchInput(e.currentTarget.value)}
					class="pl-9"
				/>
			</div>
			<div class="flex flex-wrap items-stretch gap-1">
				{#each [['name', 'Name'], ['role', 'Role'], ['status', 'Status'], ['created', 'Created']] as [field, label] (field)}
					<Button
						variant={sortField === field ? 'secondary' : 'ghost'}
						size="sm"
						class="flex-auto text-xs"
						onclick={() => handleSortClick(field)}
					>
						<Filter class="h-3.5 w-3.5" />
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

		<div class="overflow-hidden rounded-xl border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50">
					<tr>
						<th
							class="cursor-pointer px-4 py-2 text-left font-medium select-none"
							onclick={() => togglePageSort('name')}
						>
							<span class="inline-flex items-center gap-1">
								User
								{#if pageSortField === 'name'}
									{#if pageSortDir === 'asc'}
										<ArrowUp class="h-3 w-3" />
									{:else}
										<ArrowDown class="h-3 w-3" />
									{/if}
								{/if}
							</span>
						</th>
						<th
							class="cursor-pointer px-4 py-2 text-left font-medium select-none"
							onclick={() => togglePageSort('role')}
						>
							<span class="inline-flex items-center gap-1">
								Role
								{#if pageSortField === 'role'}
									{#if pageSortDir === 'asc'}
										<ArrowUp class="h-3 w-3" />
									{:else}
										<ArrowDown class="h-3 w-3" />
									{/if}
								{/if}
							</span>
						</th>
						<th
							class="cursor-pointer px-4 py-2 text-left font-medium select-none"
							onclick={() => togglePageSort('status')}
						>
							<span class="inline-flex items-center gap-1">
								Status
								{#if pageSortField === 'status'}
									{#if pageSortDir === 'asc'}
										<ArrowUp class="h-3 w-3" />
									{:else}
										<ArrowDown class="h-3 w-3" />
									{/if}
								{/if}
							</span>
						</th>
						<th
							class="cursor-pointer px-4 py-2 text-left font-medium select-none"
							onclick={() => togglePageSort('created')}
						>
							<span class="inline-flex items-center gap-1">
								Joined
								{#if pageSortField === 'created'}
									{#if pageSortDir === 'asc'}
										<ArrowUp class="h-3 w-3" />
									{:else}
										<ArrowDown class="h-3 w-3" />
									{/if}
								{/if}
							</span>
						</th>
						<th class="w-44 px-4 py-2 text-left font-medium">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedUsers as user (user.id)}
						<tr
							class="border-t transition-colors hover:bg-muted/20 {user.deactivatedAt
								? 'opacity-50'
								: ''}"
						>
							<td class="px-4 py-2">
								<div class="font-medium">{user.name}</div>
								<div class="text-xs text-muted-foreground">{user.email}</div>
								<div class="mt-1 text-xs text-muted-foreground">
									{user._count.createdProjects} projects &middot; {user._count.memberships}{' '}
									memberships
								</div>
							</td>
							<td class="px-4 py-2">
								{#if user.isSuperAdmin}
									<Badge
										variant="default"
										class="h-5 gap-1 bg-amber-500 px-1.5 py-0 text-xs text-white"
									>
										<Shield class="h-3 w-3" />
										Super Admin
									</Badge>
								{:else}
									<span class="text-muted-foreground">User</span>
								{/if}
							</td>
							<td class="px-4 py-2">
								{#if user.deactivatedAt}
									<span class="text-red-600 dark:text-red-400">Deactivated</span>
								{:else}
									<span class="text-green-600 dark:text-green-400">Active</span>
								{/if}
							</td>
							<td class="px-4 py-2 text-muted-foreground">{shortDate(user.createdAt)}</td>
							<td class="px-4 py-2">
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
				{data.q
					? `No users matching "${data.q}"`
					: roleFilter !== 'all'
						? 'No users match the selected filter'
						: 'No users found'}
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
