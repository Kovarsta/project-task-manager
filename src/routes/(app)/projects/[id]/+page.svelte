<script lang="ts">
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';

	let { data } = $props<{
		data: {
			summary: {
				created: number;
				completed: number;
				inProgress: number;
				overdue: number;
				chart: { labels: string[]; data: number[] };
			};
		};
	}>();

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let chartInstance: Chart | null = null;

	const hasData = $derived(data.summary.created > 0 || data.summary.completed > 0);

	onMount(() => {
		if (!hasData || !canvasEl) return;

		chartInstance = new Chart(canvasEl, {
			type: 'doughnut',
			data: {
				labels: data.summary.chart.labels,
				datasets: [
					{
						data: data.summary.chart.data,
						backgroundColor: ['#4ade80', '#f87171'],
						borderWidth: 0
					}
				]
			},
			options: {
				responsive: true,
				plugins: {
					legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12 } } }
				}
			}
		});

		return () => chartInstance?.destroy();
	});
</script>

<div class="mb-6 grid max-w-2xl grid-cols-2 gap-4">
	<div class="rounded-xl border p-4">
		<p class="text-2xl font-bold">{data.summary.completed} Completed</p>
		<p class="text-xs text-muted-foreground">In the last 7 days</p>
	</div>
	<div class="rounded-xl border p-4">
		<p class="text-2xl font-bold">{data.summary.created} Created</p>
		<p class="text-xs text-muted-foreground">In the last 7 days</p>
	</div>
</div>

<div class="max-w-md rounded-xl border p-4">
	<h3 class="mb-3 text-sm font-semibold">Status overview</h3>
	<div class="relative h-48">
		{#if hasData}
			<canvas bind:this={canvasEl}></canvas>
		{:else}
			<div class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
				No activity in the last 7 days
			</div>
		{/if}
	</div>
	<p class="mt-2 text-xs text-muted-foreground">During the last 7 days</p>
</div>

