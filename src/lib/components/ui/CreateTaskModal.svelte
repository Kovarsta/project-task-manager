<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import UserSearchSelect from '$lib/components/ui/UserSearchSelect.svelte';
	import TagInput from '$lib/components/ui/TagInput.svelte';
	import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte';
	import NativeSelect from '$lib/components/ui/NativeSelect.svelte';
	import { invalidateAll } from '$app/navigation';
	import { sanitizeHtml } from '$lib/sanitize';

	let {
		open = $bindable(),
		projectId,
		members,
		defaultStatus = 'TODO',
		onCreated
	} = $props<{
		defaultStatus?: 'TODO' | 'DOING' | 'DONE';
		open: boolean;
		projectId: number;
		members: { id: number; user: { id: number; name: string } }[];
		onCreated: () => void;
	}>();

	let dueDateInput = $state<HTMLInputElement | null>(null);
	let errors = $state({ title: false, description: false });
	let title = $state('');
	let description = $state('');
	let tags = $state<string[]>([]);
	let status = $state<'TODO' | 'DOING' | 'DONE'>('TODO');
	let priority = $state('MEDIUM');
	let dueDate = $state('');
	const today = new Date().toLocaleDateString('en-CA');
	let assigneeId = $state('');
	let creating = $state(false);
	let showConfirmClose = $state(false);

	function hasUnsaved() {
		return title.trim() || description || tags.length || status !== 'TODO' || priority !== 'MEDIUM' || dueDate || assigneeId;
	}

	function onInteractOutside(e: Event) {
		if (hasUnsaved()) {
			e.preventDefault();
			showConfirmClose = true;
		}
	}

	function onEscapeKeydown(e: KeyboardEvent) {
		if (hasUnsaved()) {
			e.preventDefault();
			showConfirmClose = true;
		}
	}

	function discardAndClose() {
		title = '';
		description = '';
		tags = [];
		status = 'TODO';
		priority = 'MEDIUM';
		dueDate = '';
		assigneeId = '';
		showConfirmClose = false;
		open = false;
	}

	function requestClose() {
		if (hasUnsaved()) {
			showConfirmClose = true;
		} else {
			open = false;
		}
	}

	$effect(() => {
		if (open) {
			status = defaultStatus;
			errors = { title: false, description: false };
		}
	});

	// Strip HTML tags to get plain text length for validation
	function stripHtml(html: string) {
		return html.replace(/<[^>]*>/g, '').trim();
	}

	async function create(e: SubmitEvent) {
		e.preventDefault();
		errors = { title: false, description: false };
		let hasError = false;
		if (!title.trim()) {
			errors.title = true;
			hasError = true;
		}

		const plainDesc = stripHtml(description);
		if (plainDesc.length > 2000) {
			errors.description = true;
			hasError = true;
		}

		if (hasError) {
			toast.error('Please fix the errors above');
			return;
		}

		creating = true;
		try {
			const res = await fetch(`/api/projects/${projectId}/tasks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: title.trim(),
					description: plainDesc ? sanitizeHtml(description.trim()) : null,
					tags,
					status,
					priority,
					dueDate: dueDate || null,
					assigneeId: assigneeId || null
				})
			});

			if (!res.ok) {
				const err = await res.json();
				toast.error(err.message);
				return;
			}

			toast.success('Task created');
			title = '';
			description = '';
			tags = [];
			status = 'TODO';
			priority = 'MEDIUM';
			dueDate = '';
			assigneeId = '';
			open = false;
			onCreated();
		} finally {
			creating = false;
		}

		await invalidateAll();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-2xl overflow-y-visible max-h-none" showCloseButton={false} {onInteractOutside} {onEscapeKeydown}>
		<Dialog.Header>
			<div class="flex items-center justify-between">
				<Dialog.Title>Create Task</Dialog.Title>
				<button type="button" aria-label="Close" onclick={requestClose} class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
				</button>
			</div>
		</Dialog.Header>

		<form onsubmit={create}>
			<div class="space-y-4">
				<!-- Title -->
				<div>
					<label for="ct-title" class="mb-1 block text-sm font-medium"
						>Name <span class="text-red-500">*</span></label
					>
					<Input
						id="ct-title"
						bind:value={title}
						disabled={creating}
						placeholder="Task title..."
						class={errors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}
					/>
					{#if errors.title}
						<p class="mt-1 text-xs text-red-500">Title is required</p>
					{/if}
				</div>

				<!-- Description (rich text) -->
				<div>
					<label for="ct-description" class="mb-1 block text-sm font-medium">Description</label>
					<RichTextEditor
						bind:content={description}
						disabled={creating}
						placeholder="Describe the task..."
					/>
					{#if errors.description}
						<p class="mt-1 text-xs text-red-500">
							Description plain text must be under 2000 characters
						</p>
					{/if}
				</div>

				<!-- Tags -->
				<div>
					<label class="mb-1 block text-sm font-medium">
						Tags
						<TagInput bind:tags disabled={creating} />
					</label>
					<p class="mt-1 text-xs text-muted-foreground/60">
						e.g. tag1, tag2, tag3... (press Enter or comma to add) · max 10 tags
					</p>
				</div>

				<!-- Status / Priority -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="ct-status" class="mb-1 block text-sm font-medium">Status</label>
						<NativeSelect id="ct-status" bind:value={status} class="w-full">
							<option value="TODO">TODO</option>
							<option value="DOING">DOING</option>
							<option value="DONE">DONE</option>
						</NativeSelect>
					</div>
					<div>
						<label for="ct-priority" class="mb-1 block text-sm font-medium">Priority</label>
						<NativeSelect id="ct-priority" bind:value={priority} class="w-full">
							<option value="LOWEST">Lowest</option>
							<option value="LOW">Low</option>
							<option value="MEDIUM">Medium</option>
							<option value="HIGH">High</option>
							<option value="HIGHEST">Highest</option>
						</NativeSelect>
					</div>
				</div>

				<!-- Due Date / Assignee -->
				<div class="grid grid-cols-2 gap-3">
					<div
						onclick={() => dueDateInput?.showPicker?.()}
						onkeydown={(e) => e.key === 'Enter' && dueDateInput?.showPicker?.()}
						role="button"
						tabindex="0"
						class="cursor-pointer"
					>
						<label for="ct-dueDate" class="mb-1 block text-sm font-medium">Due Date</label>
						<Input id="ct-dueDate" type="date" bind:value={dueDate} bind:ref={dueDateInput} class="cursor-pointer" min={today} />
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium">
							Assignee
							<UserSearchSelect
								bind:value={assigneeId}
								{members}
								placeholder="Search project members..."
							/>
						</label>
					</div>
				</div>
			</div>

			<Dialog.Footer>
				<Button type="submit" class="w-full" disabled={creating}>
					{creating ? 'Creating...' : 'Create Task'}
				</Button>
			</Dialog.Footer>
		</form>

		{#if showConfirmClose}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onclick={() => (showConfirmClose = false)} onkeydown={(e) => e.key === 'Escape' && (showConfirmClose = false)} role="presentation">
				<div tabindex="-1" class="mx-4 w-full max-w-sm rounded-xl bg-popover p-6 text-sm shadow-lg ring-1 ring-foreground/10" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog">
					<h3 class="text-base font-semibold text-foreground">Discard changes?</h3>
					<p class="mt-2 text-muted-foreground">You have unsaved changes. Are you sure you want to discard them?</p>
					<div class="mt-4 flex gap-2">
						<Button variant="outline" class="flex-1" onclick={() => (showConfirmClose = false)}>Keep editing</Button>
						<Button variant="destructive" class="flex-1" onclick={discardAndClose}>Discard</Button>
					</div>
				</div>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
