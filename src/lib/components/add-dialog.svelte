<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { todayInput } from '$lib/trackings';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	type AddResult = { added: string[]; duplicates: string[]; invalid: string[] };

	let adding = $state(false);
	let skipped = $state<AddResult | null>(null);

	function reset() {
		skipped = null;
	}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(v) => {
		if (!v) reset();
	}}
>
	<Dialog.Content class="sm:max-w-lg">
		<form
			method="POST"
			action="?/add"
			class="grid gap-4"
			use:enhance={() => {
				adding = true;
				return async ({ result, update }) => {
					adding = false;
					if (result.type === 'success' && result.data) {
						const d = result.data as AddResult;
						if (d.added.length) toast.success(`Added ${d.added.length} tracking${d.added.length === 1 ? '' : 's'}`);
						if (d.duplicates.length) toast.warning(`${d.duplicates.length} duplicate${d.duplicates.length === 1 ? '' : 's'} skipped`);
						if (d.invalid.length) toast.error(`${d.invalid.length} invalid skipped`);
						const hadProblems = d.duplicates.length > 0 || d.invalid.length > 0;
						skipped = hadProblems ? d : null;
						await update({ reset: d.added.length > 0 });
						// Close when everything went in; stay open so the user can see what was skipped.
						if (!hadProblems) open = false;
					} else if (result.type === 'failure') {
						toast.error(String(result.data?.error ?? 'Could not add'));
						await update({ reset: false });
					} else {
						await update();
					}
				};
			}}
		>
			<Dialog.Header>
				<Dialog.Title>Add trackings</Dialog.Title>
				<Dialog.Description>
					Paste one or many numbers, separated by new lines, spaces or commas. Duplicates are
					rejected.
				</Dialog.Description>
			</Dialog.Header>

			<Textarea
				name="numbers"
				required
				rows={5}
				autofocus
				placeholder={'YT2512345678901234\nLP00123456789012'}
				class="font-mono text-sm"
			/>

			<div class="grid gap-1.5">
				<Label for="add-ordered_at">Ordered on</Label>
				<Input id="add-ordered_at" name="ordered_at" type="date" value={todayInput()} max={todayInput()} required />
			</div>

			<div class="grid gap-1.5">
				<Label for="add-comment">
					Comment <span class="text-muted-foreground font-normal">(optional, applies to all pasted numbers)</span>
				</Label>
				<Textarea id="add-comment" name="comment" rows={2} maxlength={2000} placeholder="What is it, who sent it…" />
			</div>

			{#if skipped}
				<div class="bg-muted/60 rounded-md p-3 text-xs">
					{#if skipped.duplicates.length}
						<p class="mb-1 font-medium">Already exist (skipped):</p>
						<p class="font-mono break-all">{skipped.duplicates.join(', ')}</p>
					{/if}
					{#if skipped.invalid.length}
						<p class="mt-2 mb-1 font-medium">Invalid (too short/long):</p>
						<p class="font-mono break-all">{skipped.invalid.join(', ')}</p>
					{/if}
				</div>
			{/if}

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add'}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
