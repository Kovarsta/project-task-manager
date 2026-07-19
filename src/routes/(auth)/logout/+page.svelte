<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/login');
	});
</script>

<div class="flex h-screen items-center justify-center text-sm text-muted-foreground">
	Logging out…
</div>
