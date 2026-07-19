<script lang="ts">
	import { Input } from '$lib/components/ui/input';

	let {
		value = $bindable(),
		placeholder = 'Search by name or email...',
		members = null,
		currentAssignee = null
	}: {
		value: string;
		placeholder?: string;
		members?: { user: { id: number; name: string; email: string } }[] | null;
		currentAssignee?: { id: number; name: string; email: string } | null;
	} = $props();

	let query = $state('');
	let suggestions = $state<{ id: number; name: string; email: string }[]>([]);
	let showSuggestions = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout>;
	let inputEl: HTMLInputElement | null = null;
	let lastSyncedValue = $state<string | null>(null);

	$effect(() => {
		if (value && value !== lastSyncedValue) {
			if (members) {
				const match = members.find((m) => String(m.user.id) === String(value));
				if (match) query = match.user.name;
				else if (currentAssignee && String(currentAssignee.id) === value) query = currentAssignee.name;
			}
			lastSyncedValue = value;
		}
	});

	function clickOutside(node: HTMLElement) {
		function handler(e: MouseEvent) {
			if (!node.contains(e.target as Node)) {
				showSuggestions = false;
			}
		}
		document.addEventListener('click', handler, true);
		return { destroy() { document.removeEventListener('click', handler, true); } };
	}

	let action: ReturnType<typeof clickOutside> | undefined;

	$effect(() => {
		action?.destroy();
		if (inputEl) action = clickOutside(inputEl);
		return () => action?.destroy();
	});

	async function search() {
		if (members) {
			suggestions = members
				.map((m) => m.user)
				.filter(
					(u) =>
						!query.trim() ||
						u.name.toLowerCase().includes(query.toLowerCase()) ||
						u.email.toLowerCase().includes(query.toLowerCase())
				)
				.slice(0, 5);
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
		if (members) {
			if (!query.trim()) value = '';
		} else {
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
</script>

<div class="relative">
	<Input
		bind:ref={inputEl}
		bind:value={query}
		oninput={onInput}
		onfocus={() => suggestions.length > 0 && (showSuggestions = true)}
		{placeholder}
	/>

	{#if showSuggestions && suggestions.length > 0}
		<div
			class="absolute left-0 top-full w-full z-50 rounded-lg border bg-background shadow-lg max-h-[min(30vh,320px)] overflow-y-auto"
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
