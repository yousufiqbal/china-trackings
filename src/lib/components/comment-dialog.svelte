<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import type { Tracking } from '$lib/trackings';

	let {
		tracking = $bindable(null),
		onDone
	}: { tracking: Tracking | null; onDone?: () => void } = $props();

	let saving = $state(false);
	let open = $derived(tracking !== null);
	let text = $state('');
	let textarea = $state<HTMLTextAreaElement | null>(null);

	// Load the current comment whenever a (different) tracking is opened.
	$effect(() => {
		text = tracking?.notes ?? '';
	});

	// One-click phrases. Edit this list to taste.
	const QUICK = ['Pending Receipt, Alerted'];

	/** Append a phrase (comma-separated) unless it is already in the comment. */
	function addQuick(phrase: string) {
		const parts = text
			.split(/[,\n]/)
			.map((p) => p.trim().toLowerCase())
			.filter(Boolean);
		const wanted = phrase
			.split(',')
			.map((p) => p.trim())
			.filter((p) => !parts.includes(p.toLowerCase()));
		if (!wanted.length) return;
		const base = text.trim().replace(/,\s*$/, '');
		text = base ? `${base}, ${wanted.join(', ')}` : wanted.join(', ');
		textarea?.focus();
	}
</script>

<Dialog.Root
	{open}
	onOpenChange={(v) => {
		if (!v) tracking = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		{#if tracking}
			<form
				method="POST"
				action="/?/comment"
				class="grid gap-4"
				use:enhance={() => {
					saving = true;
					return async ({ result, update }) => {
						saving = false;
						if (result.type === 'success') {
							toast.success('Comment saved');
							tracking = null;
							onDone?.();
						} else if (result.type === 'failure') {
							toast.error(String(result.data?.error ?? 'Could not save'));
						}
						await update({ reset: false });
					};
				}}
			>
				<input type="hidden" name="id" value={tracking.id} />
				<Dialog.Header>
					<Dialog.Title>Comment</Dialog.Title>
					<Dialog.Description class="font-mono">{tracking.tracking_no}</Dialog.Description>
				</Dialog.Header>

				<div class="flex flex-wrap gap-2">
					{#each QUICK as q (q)}
						<Button type="button" variant="secondary" size="sm" onclick={() => addQuick(q)}>
							+ {q}
						</Button>
					{/each}
				</div>

				<Textarea
					bind:ref={textarea}
					bind:value={text}
					name="comment"
					rows={5}
					autofocus
					maxlength={2000}
					placeholder="What is it, who sent it, anything worth remembering…"
					onkeydown={(e) => {
						if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') e.currentTarget.form?.requestSubmit();
					}}
				/>
				<p class="text-muted-foreground -mt-2 text-xs">Ctrl+Enter to save</p>

				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (tracking = null)}>Cancel</Button>
					<Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
