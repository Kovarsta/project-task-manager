<script lang="ts">
	import { goto } from '$app/navigation';
	import { signOut } from '@auth/sveltekit/client';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { FolderKanban } from '@lucide/svelte';

	let { data } = $props();
	let accepting = $state(false);

	async function accept() {
		accepting = true;
		try {
			const res = await fetch(`/api/invites/${page.params.token}/accept`, { method: 'POST' });
			const result = await res.json();

			if (!res.ok) {
				toast.error(result.message);
				return;
			}

			toast.success('Joined project!');
			goto(`/projects/${result.projectId}`);
		} finally {
			accepting = false;
		}
	}

	function switchAccount() {
		signOut({ redirectTo: `/login?redirectTo=/invite/${page.params.token}` });
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-background">
	<div class="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
		{#if data.error}
			<div class="flex flex-col items-center gap-2 text-center">
				<FolderKanban class="h-10 w-10 text-muted-foreground" />
				<h1 class="text-xl font-bold text-foreground">Invalid Invite</h1>
				<p class="text-sm text-muted-foreground">{data.error}</p>
			</div>
			<div class="mt-6 space-y-2">
				{#if data.invitedEmail}
					<Button variant="outline" class="w-full" onclick={switchAccount}>
						Sign in with a different account
					</Button>
				{/if}
				<Button variant="ghost" class="w-full" onclick={() => goto('/')}>Go home</Button>
			</div>
		{:else}
			<div class="flex flex-col items-center gap-2 text-center">
				<FolderKanban class="h-10 w-10 text-foreground" />
				<h1 class="text-xl font-bold text-foreground">Invitation</h1>
				<p class="text-sm text-muted-foreground">
					You have been invited to <strong>{data.projectName}</strong>
				</p>
			</div>
			<div class="mt-6">
				<Button class="w-full" onclick={accept} disabled={accepting}>
					{accepting ? 'Joining...' : 'Accept Invitation'}
				</Button>
			</div>
		{/if}
	</div>
</div>
