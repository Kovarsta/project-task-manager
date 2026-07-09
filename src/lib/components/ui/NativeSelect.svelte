<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type Props = WithElementRef<HTMLSelectAttributes> & {
		children?: Snippet;
	};

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		children,
		...restProps
	}: Props = $props();
</script>

<select
	bind:this={ref}
	bind:value
	class={cn(
		'h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 pr-8 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30 dark:disabled:bg-input/80',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</select>
