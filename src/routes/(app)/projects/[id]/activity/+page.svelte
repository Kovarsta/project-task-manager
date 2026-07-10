<script lang="ts">
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import type { ActivityItem } from '$lib/activity';
	import { describeActivity, timeAgo } from '$lib/activity';

	let { data } = $props<{
		data: {
			logs: ActivityItem[];
			meta: { page: number; limit: number; total: number; totalPages: number };
		};
	}>();

	let currentPage = $state(data.meta.page);
	let limit = $state(data.meta.limit);

	function reload() {
		goto(`?page=${currentPage}&limit=${limit}`, { keepFocus: true });
	}
</script>

<div class="rounded-xl border bg-card p-5 shadow-sm">
	<div class="mb-4 flex items-center justify-between">
		<div>
			<h3 class="text-lg font-bold text-foreground">Activity</h3>
			<p class="text-xs text-muted-foreground">All actions in this project</p>
		</div>
	</div>

	{#if data.logs.length > 0}
		<div class="space-y-2">
			{#each data.logs as log (log.id)}
				<div class="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
					<span class="shrink-0 font-medium text-foreground">{log.user.name}</span>
					<span class="text-muted-foreground">{describeActivity(log)}</span>
					<span class="ml-auto shrink-0 text-xs text-muted-foreground/60"
						>{timeAgo(log.createdAt)}</span
					>
				</div>
			{/each}
		</div>
	{:else}
		<div class="py-6 text-center text-sm text-muted-foreground">No activity yet</div>
	{/if}
</div>

<Pagination bind:page={currentPage} bind:limit totalPages={data.meta.totalPages} onChange={reload} />
