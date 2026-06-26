<script lang="ts">
	import { page } from '$app/state';
	import { signOut } from '@auth/sveltekit/client';
	import { LayoutDashboard, FolderKanban, ChevronLeft, Shield } from '@lucide/svelte';
	import { Toaster } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

	let { data, children } = $props();
	let sidebarOpen = $state(true);
</script>

<Toaster richColors position="top-right" />

<div class="flex h-screen overflow-hidden bg-background text-foreground">
	<!-- Sidebar -->
	<aside
		class="flex flex-col border-r bg-muted/40 transition-all duration-300 {sidebarOpen
			? 'w-56'
			: 'w-0 overflow-hidden'}"
	>
		<button class="flex h-14 items-center gap-2 border-b px-4" onclick={() => goto('/')}>
			<FolderKanban class="h-5 w-5 shrink-0" />
			<span class="truncate text-sm leading-none font-semibold">Project Manager</span>
		</button>

		<nav class="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3">
			<button
				onclick={() => goto('/')}
				class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent
    {page.url.pathname === '/' && page.url.searchParams.get('tab') !== 'shared'
					? 'bg-accent font-medium'
					: ''}"
			>
				<LayoutDashboard class="h-4 w-4 shrink-0" />
				My Projects
			</button>

			<!-- Shared Projects -->
			<button
				onclick={() => goto('/?tab=shared')}
				class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent
    {page.url.pathname === '/' && page.url.searchParams.get('tab') === 'shared'
					? 'bg-accent font-medium'
					: ''}"
			>
				<FolderKanban class="h-4 w-4 shrink-0" />
				Shared Projects
			</button>
		</nav>

		{#if data.session?.user?.isSuperAdmin}
			<div class="border-t px-2 py-3">
				<button
					onclick={() => goto('/admin')}
					class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent {page.url.pathname.startsWith(
						'/admin'
					)
						? 'bg-accent font-medium'
						: ''}"><Shield class="h-4 w-4 shrink-0" />Admin</button
				>
			</div>
		{/if}
	</aside>

	<!-- Main -->

	<div class="flex min-w-0 flex-1 flex-col">
		<!-- Navbar -->

		<header
			class="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 py-5"
		>
			<div class="flex items-center gap-2">
				<button onclick={() => (sidebarOpen = !sidebarOpen)} class="rounded p-1 hover:bg-accent">
					<ChevronLeft class="h-4 w-4 transition-transform {sidebarOpen ? '' : 'rotate-180'}" />
				</button>

				<span class="text-sm font-semibold">Project Manager</span>
			</div>

			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					<button class="flex items-center gap-2 rounded p-1 hover:bg-accent">
						{#if data.session?.user?.image}
							<img src={data.session.user.image} alt="avatar" class="h-7 w-7 rounded-full" />
						{:else}
							<div
								class="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium"
							>
								{data.session?.user?.name?.[0]?.toUpperCase() ?? '?'}
							</div>
						{/if}
					</button>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-56">
					<div class="border-b px-3 py-2">
						<p class="truncate text-sm font-medium">{data.session?.user?.name}</p>
						<p class="truncate text-xs text-muted-foreground">{data.session?.user?.email}</p>
					</div>
					<DropdownMenu.Item
						class="mt-1 cursor-pointer text-red-500"
						onclick={() => signOut({ redirectTo: '/login' })}
					>
						Đăng xuất
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</header>

		<!-- Page content -->
		<main class="flex-1 overflow-y-auto">{@render children()}</main>
	</div>
</div>
