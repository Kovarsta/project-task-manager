<script lang="ts">
	import { Input } from '$lib/components/ui/input';

	let {
		value = $bindable(),
		placeholder = 'Search by name or email...',
		members = null
	}: {
		value: string;
		placeholder?: string;
		members?: { user: { id: number; name: string; email: string } }[] | null;
	} = $props();

	let query = $state('');
	let suggestions = $state<{ id: number; name: string; email: string }[]>([]);
	let showSuggestions = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout>;
	let containerEl: HTMLDivElement;

	let lastSyncedValue = $state<string | null>(null);

	$effect(() => {
		if (value && members && value !== lastSyncedValue) {
			const match = members.find((m) => String(m.user.id) === String(value));
			if (match) query = match.user.name;
			lastSyncedValue = value;
		}
	});

	async function search() {
		if (members) {
			suggestions = members
				.map((m) => m.user)
				.filter(
					(u) =>
						u.name.toLowerCase().includes(query.toLowerCase()) ||
						u.email.toLowerCase().includes(query.toLowerCase())
				);
			showSuggestions = true;
			return;
		}

		if (query.trim().length < 2) {
			suggestions = [];
			showSuggestions = false;
			return;
		}
		const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
		suggestions = await res.json();
		showSuggestions = true;
	}

	function onInput() {
		if (!members) {
			value = query;
		}

		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(search, 200);
	}

	function select(user: { id: number; name: string; email: string }) {
		value = members ? String(user.id) : user.email;
		query = members ? user.name : user.email;
		showSuggestions = false;
	}

	function onClickOutside(e: MouseEvent) {
		if (containerEl && !containerEl.contains(e.target as Node)) {
			showSuggestions = false;
		}
	}

	$effect(() => {
		document.addEventListener('click', onClickOutside);
		return () => document.removeEventListener('click', onClickOutside);
	});
</script>

<div bind:this={containerEl} class="relative">
	<Input
		bind:value={query}
		oninput={onInput}
		onfocus={() => suggestions.length > 0 && (showSuggestions = true)}
		{placeholder}
	/>

	{#if showSuggestions && suggestions.length > 0}
		<div
			class="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-background shadow-lg"
		>
			{#each suggestions as user (user.id)}
				<button
					type="button"
					onclick={() => select(user)}
					class="w-full px-3 py-2 text-left text-sm hover:bg-accent"
				>
					<p class="font-medium">{user.name}</p>
					<p class="text-xs text-muted-foreground">{user.email}</p>
				</button>
			{/each}
		</div>
	{/if}
</div>
