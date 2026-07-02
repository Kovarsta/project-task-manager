<script lang="ts">
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';
	import { AlertTriangle, Clock, CheckCircle2, PlusCircle, ArrowRight } from '@lucide/svelte';
	import type { Task } from '$lib/type';
	import { page } from '$app/state';

	let { data } = $props<{
		data: {
			summary: {
				created: number;
				completed: number;
				inProgress: number;
				overdue: number;
				urgentTasks: Task[];
				chart: { labels: string[]; data: number[] };
			};
		};
	}>();

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let chartInstance: Chart | null = null;

	const hasData = $derived(data.summary.created > 0 || data.summary.completed > 0);
	const projectId = $derived(page.params.id);

	onMount(() => {
		if (!hasData || !canvasEl) return;

		chartInstance = new Chart(canvasEl, {
			type: 'doughnut',
			data: {
				labels: data.summary.chart.labels,
				datasets: [
					{
						data: data.summary.chart.data,
						backgroundColor: ['#f87171', '#4ade80'], // Created is Red (#f87171), Completed is Green (#4ade80)
						borderWidth: 0
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } }
				}
			}
		});

		return () => chartInstance?.destroy();
	});

	const priorityColors: Record<string, string> = {
		LOWEST: 'bg-gray-100 text-gray-700',
		LOW: 'bg-blue-50 text-blue-700',
		MEDIUM: 'bg-yellow-50 text-yellow-700',
		HIGH: 'bg-orange-50 text-orange-700',
		HIGHEST: 'bg-red-50 text-red-700 border border-red-200'
	};

	function isOverdue(dueDateStr: string | null) {
		if (!dueDateStr) return false;
		return new Date(dueDateStr) < new Date();
	}
</script>

<div class="space-y-6">
	<!-- Stats Grid -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
		<!-- Completed -->
		<div class="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40">
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed</span>
				<CheckCircle2 class="h-4 w-4 text-muted-foreground" />
			</div>
			<p class="mt-2 text-3xl font-extrabold text-foreground">{data.summary.completed}</p>
			<p class="mt-1 text-xxs text-muted-foreground/80">In the last 7 days</p>
		</div>

		<!-- Created -->
		<div class="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40">
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</span>
				<PlusCircle class="h-4 w-4 text-muted-foreground" />
			</div>
			<p class="mt-2 text-3xl font-extrabold text-foreground">{data.summary.created}</p>
			<p class="mt-1 text-xxs text-muted-foreground/80">In the last 7 days</p>
		</div>

		<!-- In Progress -->
		<div class="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40">
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">In Progress</span>
				<Clock class="h-4 w-4 text-muted-foreground" />
			</div>
			<p class="mt-2 text-3xl font-extrabold text-foreground">{data.summary.inProgress}</p>
			<p class="mt-1 text-xxs text-muted-foreground/80">Active tasks</p>
		</div>

		<!-- Overdue -->
		<div class="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40">
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overdue</span>
				<AlertTriangle class="h-4 w-4 text-muted-foreground" />
			</div>
			<p class="mt-2 text-3xl font-extrabold text-foreground">{data.summary.overdue}</p>
			<p class="mt-1 text-xxs text-muted-foreground/80">Missed deadlines</p>
		</div>
	</div>

	<!-- Main Details Grid -->
	<div class="grid gap-6 lg:grid-cols-5">
		<!-- Left: Urgent / Upcoming Tasks List -->
		<div class="rounded-xl border bg-card p-5 shadow-sm lg:col-span-3">
			<div class="mb-4 flex items-center justify-between">
				<div>
					<h3 class="font-bold text-foreground">Urgent Tasks</h3>
					<p class="text-xs text-muted-foreground">Highest priority or earliest deadlines first</p>
				</div>
				<a href="/projects/{projectId}/list" class="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
					View all list <ArrowRight class="h-3.5 w-3.5" />
				</a>
			</div>

			<div class="divide-y">
				{#if data.summary.urgentTasks && data.summary.urgentTasks.length > 0}
					{#each data.summary.urgentTasks as task (task.id)}
						<div class="flex items-center justify-between py-3 first:pt-0 last:pb-0">
							<div class="min-w-0 flex-1 pr-4">
								<p class="truncate text-sm font-semibold text-foreground">{task.title}</p>
								<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
									<span class="rounded-full px-2 py-0.5 text-xxs font-medium {priorityColors[task.priority]}">
										{task.priority}
									</span>
									{#if task.dueDate}
										<span class="flex items-center gap-0.5 {isOverdue(task.dueDate) ? 'font-medium text-red-600' : ''}">
											Due {new Date(task.dueDate).toLocaleDateString()}
										</span>
									{/if}
									{#if task.assignee}
										<span>· Assigned to {task.assignee.name}</span>
									{/if}
								</div>
							</div>
							<span class="rounded-md border px-2 py-1 text-xxs font-semibold uppercase bg-muted/50 tracking-wider">
								{task.status}
							</span>
						</div>
					{/each}
				{:else}
					<div class="py-8 text-center text-sm text-muted-foreground">
						No active tasks left in the project! 🎉
					</div>
				{/if}
			</div>
		</div>

		<!-- Right: Status Overview Chart -->
		<div class="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
			<h3 class="mb-1 font-bold text-foreground">Activity Summary</h3>
			<p class="mb-4 text-xs text-muted-foreground">Created vs Completed comparison (last 7 days)</p>
			<div class="relative flex h-52 items-center justify-center">
				{#if hasData}
					<canvas bind:this={canvasEl}></canvas>
				{:else}
					<div class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
						No project activity in the last 7 days
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
