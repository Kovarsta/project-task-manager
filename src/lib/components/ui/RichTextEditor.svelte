<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Underline from '@tiptap/extension-underline';
	import Link from '@tiptap/extension-link';
	import Placeholder from '@tiptap/extension-placeholder';
	import {
		Bold,
		Italic,
		Underline as UnderlineIcon,
		Link as LinkIcon,
		Heading2,
		List,
		ListOrdered,
		Unlink
	} from '@lucide/svelte';

	let {
		content = $bindable(''),
		disabled = false,
		placeholder: placeholderText = 'Add a description...',
		class: className = ''
	}: {
		content: string;
		disabled?: boolean;
		placeholder?: string;
		class?: string;
	} = $props();

	let editorEl: HTMLDivElement | null = null;
	let editor: Editor | null = null;
	let editorState = $state({ bold: false, italic: false, underline: false, link: false, h2: false });

	function updateState() {
		if (!editor) return;
		editorState = {
			bold: editor.isActive('bold'),
			italic: editor.isActive('italic'),
			underline: editor.isActive('underline'),
			link: editor.isActive('link'),
			h2: editor.isActive('heading', { level: 2 })
		};
	}

	onMount(() => {
		editor = new Editor({
			element: editorEl!,
			extensions: [
				StarterKit.configure({
					// Disable heading levels we don't need
					heading: { levels: [2] },
					// Keep bullet/ordered lists, bold, italic, paragraph
					codeBlock: false,
					code: false,
					blockquote: false,
					horizontalRule: false,
					strike: false
				}),
				Underline,
				Link.configure({
					openOnClick: false,
					HTMLAttributes: { class: 'text-blue-600 underline' }
				}),
				Placeholder.configure({ placeholder: placeholderText })
			],
			content,
			editable: !disabled,
			onTransaction() {
				updateState();
			},
			onUpdate({ editor: e }) {
				// Get HTML, but if only empty paragraph, return empty string
				const html = e.getHTML();
				content = html === '<p></p>' ? '' : html;
			}
		});
	});

	// Keep editor editable state in sync with disabled prop
	$effect(() => {
		editor?.setEditable(!disabled);
	});

	// Sync external content changes (e.g., when a different task opens)
	$effect(() => {
		if (editor && content !== editor.getHTML() && content !== (editor.getHTML() === '<p></p>' ? '' : editor.getHTML())) {
			editor.commands.setContent(content || '', { emitUpdate: false });
		}
	});

	onDestroy(() => {
		editor?.destroy();
	});

	function setLink() {
		if (editor?.isActive('link')) {
			editor.chain().focus().unsetLink().run();
			return;
		}
		const url = prompt('Enter URL:');
		if (url) {
			editor?.chain().focus().setLink({ href: url }).run();
		}
	}

	type BtnDef = {
		label: string;
		icon: typeof Bold;
		action: () => void;
		active: () => boolean;
	};

	const buttons = $derived<BtnDef[]>([
		{
			label: 'Bold',
			icon: Bold,
			action: () => editor?.chain().focus().toggleBold().run(),
			active: () => editorState.bold
		},
		{
			label: 'Italic',
			icon: Italic,
			action: () => editor?.chain().focus().toggleItalic().run(),
			active: () => editorState.italic
		},
		{
			label: 'Underline',
			icon: UnderlineIcon,
			action: () => editor?.chain().focus().toggleUnderline().run(),
			active: () => editorState.underline
		},
		{
			label: 'Heading 2',
			icon: Heading2,
			action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
			active: () => editorState.h2
		},
		{
			label: 'Bullet list',
			icon: List,
			action: () => editor?.chain().focus().toggleBulletList().run(),
			active: () => false
		},
		{
			label: 'Numbered list',
			icon: ListOrdered,
			action: () => editor?.chain().focus().toggleOrderedList().run(),
			active: () => false
		},
		{
			label: editorState.link ? 'Unlink' : 'Link',
			icon: editorState.link ? Unlink : LinkIcon,
			action: setLink,
			active: () => editorState.link
		}
	]);
</script>

<div class="rounded-md border border-input {className}">
	<!-- Toolbar -->
	<div
		class="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/30 px-2 py-1"
	>
		{#each buttons as btn (btn.label)}
			{@const Icon = btn.icon}
			<button
				type="button"
				title={btn.label}
				{disabled}
				onclick={btn.action}
				class="rounded p-1.5 transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40
					{btn.active() ? 'bg-accent text-foreground' : 'text-muted-foreground'}"
			>
				<Icon class="h-3.5 w-3.5" />
			</button>
		{/each}
	</div>

	<!-- Editor area -->
	<div
		bind:this={editorEl}
		class="tiptap-editor min-h-32 px-3 py-2 text-sm focus-within:outline-none {disabled
			? 'cursor-not-allowed opacity-60'
			: ''}"
	></div>
</div>

<style>
	:global(.tiptap-editor .ProseMirror) {
		outline: none;
		min-height: 8rem;
	}
	:global(.tiptap-editor .ProseMirror p.is-editor-empty:first-child::before) {
		color: hsl(var(--muted-foreground) / 0.5);
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
	}
	:global(.tiptap-editor .ProseMirror h2) {
		font-size: 1.1rem;
		font-weight: 700;
		margin-bottom: 0.25rem;
		margin-top: 0.5rem;
	}
	:global(.tiptap-editor .ProseMirror ul) {
		list-style-type: disc;
		padding-left: 1.25rem;
	}
	:global(.tiptap-editor .ProseMirror ol) {
		list-style-type: decimal;
		padding-left: 1.25rem;
	}
	:global(.tiptap-editor .ProseMirror strong) {
		font-weight: 700;
	}
	:global(.tiptap-editor .ProseMirror em) {
		font-style: italic;
	}
	:global(.tiptap-editor .ProseMirror u) {
		text-decoration: underline;
	}
</style>
