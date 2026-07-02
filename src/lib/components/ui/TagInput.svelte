<script lang="ts">
	import { X } from '@lucide/svelte';

	let {
		tags = $bindable<string[]>([]),
		disabled = false,
		placeholder = 'e.g. tag1, tag2, tag3...'
	}: {
		tags: string[];
		disabled?: boolean;
		placeholder?: string;
	} = $props();

	let inputValue = $state('');

	function addTag(raw: string) {
		const tag = raw.trim().toLowerCase();
		if (!tag || tags.includes(tag) || tags.length >= 10) return;
		if (tag.length > 30) return;
		tags = [...tags, tag];
		inputValue = '';
	}

	function removeTag(tag: string) {
		tags = tags.filter((t) => t !== tag);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addTag(inputValue);
		} else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
			removeTag(tags[tags.length - 1]);
		}
	}

	function onBlur() {
		if (inputValue.trim()) addTag(inputValue);
	}

	// Tag color palette — cycles based on index
	const tagColors = [
		'bg-blue-100 text-blue-800',
		'bg-purple-100 text-purple-800',
		'bg-green-100 text-green-800',
		'bg-amber-100 text-amber-800',
		'bg-rose-100 text-rose-800',
		'bg-cyan-100 text-cyan-800',
		'bg-indigo-100 text-indigo-800',
		'bg-teal-100 text-teal-800'
	];

	function tagColor(index: number) {
		return tagColors[index % tagColors.length];
	}
</script>

<div
	class="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0 {disabled
		? 'cursor-not-allowed opacity-60'
		: ''}"
>
	{#each tags as tag, i (tag)}
		<span
			class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {tagColor(i)}"
		>
			{tag}
			{#if !disabled}
				<button
					type="button"
					onclick={() => removeTag(tag)}
					class="ml-0.5 rounded-full hover:opacity-70"
					aria-label="Remove {tag}"
				>
					<X class="h-3 w-3" />
				</button>
			{/if}
		</span>
	{/each}

	{#if !disabled || tags.length === 0}
		<input
			bind:value={inputValue}
			{disabled}
			{placeholder}
			class="min-w-24 flex-1 border-0 p-0 shadow-none focus:ring-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed"
			onkeydown={onKeydown}
			onblur={onBlur}
		/>
	{/if}
</div>

{#if tags.length >= 10}
	<p class="mt-1 text-xs text-muted-foreground">Maximum 10 tags reached</p>
{/if}
