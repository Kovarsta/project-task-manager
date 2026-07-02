<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { ListTodo, Users, Home } from '@lucide/svelte';

	let { children } = $props();

	const tabs = [
		{ label: 'Projects', icon: ListTodo, path: '/admin/projects' },
		{ label: 'Users', icon: Users, path: '/admin/users' }
	];
</script>

<div class="flex h-full flex-col">
	<div class="border-b px-6 py-4">
		<div class="mb-3 flex items-center gap-2">
			<button onclick={() => goto('/')} class="rounded p-1 hover:bg-accent">
				<Home class="h-4 w-4" />
			</button>
			<h1 class="text-xl font-bold">Administration</h1>
		</div>

		<div class="flex gap-4">
			{#each tabs as tab (tab.path)}
				{@const Icon = tab.icon}
				{@const active = page.url.pathname === tab.path}
				<button
					onclick={() => goto(tab.path)}
					class="flex items-center gap-1.5 border-b-2 px-1 py-2 text-sm transition-colors
            {active
						? 'border-blue-500 font-medium text-blue-500'
						: 'border-transparent text-muted-foreground hover:text-foreground'}"
				>
					<Icon class="h-4 w-4" />
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<main class="flex-1 overflow-y-auto p-6">
		{@render children()}
	</main>
</div>

