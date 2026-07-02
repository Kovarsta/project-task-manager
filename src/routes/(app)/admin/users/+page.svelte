<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Input } from '$lib/components/ui/input';
	import Pagination from '$lib/components/ui/Pagination.svelte';

	let { data } = $props<{
		data: { users: any[]; meta: { page: number; limit: number; totalPages: number } };
	}>();

	let search = $state('');

	let currentPage = $state(data.meta.page);
	let limit = $state(data.meta.limit);

	type UserSort = 'name' | 'superAdmin';
	let sortBy = $state<UserSort>('name');

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
			if (sortBy === 'superAdmin') return Number(b.isSuperAdmin) - Number(a.isSuperAdmin);
			return a.name.localeCompare(b.name);
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
		<Input bind:value={search} placeholder="Search" class="mb-4 max-w-sm" />
		<select bind:value={sortBy} class="rounded border px-2 py-1.5 pr-6 text-sm">
			<option value="name">Name A-Z</option>
			<option value="superAdmin">Super Admin first</option>
		</select>

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

