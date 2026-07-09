<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { ProjectMember } from '$lib/type';

	let { data, children } = $props<{
		data: { project: { members: ProjectMember[] } };
		children: import('svelte').Snippet;
	}>();
	const projectId = page.params.id;

	const isOwner = $derived(
		data.project.members?.find(
			(m: ProjectMember) => m.user.id === Number(page.data.session?.user?.id)
		)?.isOwner ?? false
	);

	const tabs = $derived([
		{ label: 'Users', path: `/projects/${projectId}/admin/users` },
		...(isOwner
			? [{ label: 'Organization', path: `/projects/${projectId}/admin/organization` }]
			: [])
	]);
</script>

<div class="flex h-full">
	<!-- Side nav -->
	<aside class="border-r pr-8">
		<nav class="flex flex-col gap-1">
			{#each tabs as tab (tab.path)}
				{@const active = page.url.pathname === tab.path}
				<button
					onclick={() => goto(tab.path)}
					class="rounded px-6 py-1.5 text-left text-sm hover:bg-accent
            {active ? 'bg-accent font-medium' : 'text-muted-foreground'}"
				>
					{tab.label}
				</button>
			{/each}
		</nav>
	</aside>

	<!-- Tab content -->
	<main class="flex-1 overflow-y-auto p-6">
		{@render children()}
	</main>
</div>
