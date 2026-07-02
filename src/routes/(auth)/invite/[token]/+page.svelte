<script lang="ts">
	import { goto } from '$app/navigation';
	import { signOut } from '@auth/sveltekit/client';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';

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

<div class="flex min-h-screen items-center justify-center bg-muted/20 p-6">
	{#if data.error}
		<div class="max-w-sm rounded-xl border bg-background p-8 text-center">
			<h2 class="mb-2 text-lg font-semibold">Invalid Invite</h2>
			<p class="mb-6 text-sm text-muted-foreground">{data.error}</p>

			{#if data.invitedEmail}
				<Button variant="outline" class="mb-2 w-full" onclick={switchAccount}>
					Sign in with a different account
				</Button>
			{/if}

			<Button variant="ghost" class="w-full" onclick={() => goto('/')}>Go home</Button>
		</div>
	{:else}
		<div class="max-w-sm rounded-xl border border-green-200 bg-green-50 p-8 text-center">
			<h2 class="mb-2 text-xl font-bold">Invitation</h2>
			<p class="mb-6 text-sm text-muted-foreground">
				You have been invited to <strong>{data.projectName}</strong>
			</p>
			<Button class="w-full" onclick={accept} disabled={accepting}>
				{accepting ? 'Joining...' : 'Accept'}
			</Button>
		</div>
	{/if}
</div>

