<script lang="ts">
	import { signIn } from '@auth/sveltekit/client';
	import { page } from '$app/state';
	import { FolderKanban } from '@lucide/svelte';

	let { data } = $props<{ data: { useMockSSO: boolean } }>();

	const provider = data.useMockSSO ? 'github' : 'microsoft-entra-id';
	const label = data.useMockSSO ? 'GitHub' : 'Microsoft';
	const redirectTo = page.url.searchParams.get('redirectTo') ?? '/';
</script>

<div class="flex min-h-screen items-center justify-center bg-background">
	<div class="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
		<div class="mb-8 flex flex-col items-center gap-2">
			<FolderKanban class="h-10 w-10 text-foreground" />
			<h1 class="text-xl font-bold text-foreground">Project Manager</h1>
			<p class="text-sm text-muted-foreground">Sign in to continue</p>
		</div>

		<button
			onclick={() => signIn(provider, { redirectTo })}
			class="flex w-full items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
		>
			{#if data.useMockSSO}
				<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
				</svg>
			{:else}
				<svg class="h-5 w-5" viewBox="0 0 23 23" fill="currentColor">
					<path d="M11.5 0C5.15 0 0 5.15 0 11.5S5.15 23 11.5 23 23 17.85 23 11.5 17.85 0 11.5 0zm5.52 17.32c-.38.38-.88.6-1.42.6H7.4c-.54 0-1.04-.22-1.42-.6-.38-.38-.6-.88-.6-1.42V7.1c0-.54.22-1.04.6-1.42.38-.38.88-.6 1.42-.6h8.2c.54 0 1.04.22 1.42.6.38.38.6.88.6 1.42v8.8c0 .54-.22 1.04-.6 1.42zM9.5 8.5v6l5.5-3-5.5-3z"/>
				</svg>
			{/if}
			Sign in with {label}
		</button>
	</div>
</div>
