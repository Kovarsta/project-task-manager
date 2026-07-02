<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
</script>

<div class="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
	<div class="max-w-md text-center">
		<p class="mb-4 text-6xl font-bold text-muted-foreground">{page.status}</p>
		<h1 class="mb-2 text-2xl font-semibold">
			{#if page.status === 404}
				Page not found
			{:else if page.status === 403}
				Access denied
			{:else if page.status === 401}
				Please log in
			{:else}
				Something went wrong
			{/if}
		</h1>
		<p class="mb-6 text-sm text-muted-foreground">
			{page.error?.message ?? 'An unexpected error occurred.'}
		</p>
		<div class="flex justify-center gap-3">
			<Button variant="outline" onclick={() => history.back()}>Go back</Button>
			<Button onclick={() => goto('/')}>Home</Button>
		</div>
	</div>
</div>

