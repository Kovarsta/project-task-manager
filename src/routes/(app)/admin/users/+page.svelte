<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { ArrowUp, ArrowDown } from '@lucide/svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';

	let { data } = $props<{
		data: { users: any[]; meta: { page: number; limit: number; totalPages: number } };
	}>();

	let search = $state('');

	let currentPage = $state(data.meta.page);
	let limit = $state(data.meta.limit);

	let sortField = $state<'name' | 'superAdmin'>('name');
	let sortDir = $state<'asc' | 'desc'>('asc');

	function handleSortClick(field: typeof sortField) {
		if (sortField === field) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDir = field === 'name' ? 'asc' : 'desc';
		}
	}

	function reload() {
		goto(`?page=${currentPage}&limit=${limit}`, { keepFocus: true });
	}

	let filtered = $derived.by(() => {
		let result = data.users.filter(
			(u: any) =>
				u.name.toLowerCase().includes(search.toLowerCase()) ||
				u.email.toLowerCase().includes(search.toLowerCase())
		);
		return [...result].sort((a, b) => {
			let cmp = 0;
			if (sortField === 'superAdmin') {
				cmp = Number(a.isSuperAdmin) - Number(b.isSuperAdmin);
			} else {
				cmp = a.name.localeCompare(b.name);
			}
			return sortDir === 'asc' ? cmp : -cmp;
		});
	});

	async function toggleSuperAdmin(user: any, value: boolean) {
		const res = await fetch(`/api/admin/users/${user.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isSuperAdmin: value })
		});

		if (!res.ok) {
			const err = await res.json();
			toast.error(err.message);
			return;
		}

		toast.success('Updated');
		invalidateAll();
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex-1 overflow-y-auto">
		<div class="mb-4 flex items-center gap-3">
			<Input bind:value={search} placeholder="Search" class="max-w-sm" />
			<div class="flex items-center gap-1">
				<span class="text-xs text-muted-foreground mr-1">Sort by:</span>
				{#each [['name', 'Name'], ['superAdmin', 'Super Admin']] as [field, label] (field)}
					<Button
						variant={sortField === field ? 'secondary' : 'ghost'}
						size="sm"
						class="gap-1 text-xs h-8"
						onclick={() => handleSortClick(field as any)}
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
		</div>

		<div class="overflow-hidden rounded-xl border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50">
					<tr>
						<th class="px-4 py-2 text-left">User(s)</th>
						<th class="px-4 py-2 text-left">Super Admin</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as user (user.id)}
						<tr class="border-t">
							<td class="px-4 py-2">
								<p class="font-medium">{user.name}</p>
								<p class="text-xs text-muted-foreground">{user.email}</p>
							</td>
							<td class="px-4 py-2">
								<select
									value={user.isSuperAdmin ? 'true' : 'false'}
									onchange={(e) => toggleSuperAdmin(user, e.currentTarget.value === 'true')}
									class="rounded border px-2 py-1 pr-6 text-sm"
								>
									<option value="true">True</option>
									<option value="false">False</option>
								</select>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if filtered.length === 0}
			<p class="mt-4 text-sm text-muted-foreground">No users found</p>
		{/if}
	</div>

	<Pagination
		bind:page={currentPage}
		bind:limit
		totalPages={data.meta.totalPages}
		onChange={reload}
	/>
</div>

