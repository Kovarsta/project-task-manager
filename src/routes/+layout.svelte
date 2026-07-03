<script lang="ts">
	import '$lib/layout.css';
	import { ModeWatcher } from 'mode-watcher';

	let { children } = $props();
</script>

<ModeWatcher />

{@render children()}
