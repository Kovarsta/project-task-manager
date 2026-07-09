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

<div class="flex h-full flex-col">
	<!-- Top nav tabs -->
	<div class="flex gap-4 border-b">
		{#each tabs as tab (tab.path)}
			{@const active = page.url.pathname === tab.path}
			<button
				onclick={() => goto(tab.path)}
				class="border-b-2 px-1 py-2 text-sm transition-colors
          {active
            ? 'border-blue-500 font-medium text-blue-500'
            : 'border-transparent text-muted-foreground hover:text-foreground'}"
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Tab content -->
	<main class="flex-1 overflow-y-auto p-6">
		{@render children()}
	</main>
</div>
