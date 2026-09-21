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

	let adding = $state(false);
	let error = $state<string | null>(null);
	let noTracking = $state(false);
</script>

<Dialog.Root
	bind:open
	onOpenChange={(v) => {
		if (!v) {
			error = null;
			noTracking = false;
		}
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<form
			method="POST"
			action="?/add"
			class="grid gap-4"
			use:enhance={() => {
				adding = true;
				error = null;
				return async ({ result, update }) => {
					adding = false;
					if (result.type === 'success' && result.data) {
						toast.success(`Added ${(result.data as { tracking_no: string | null }).tracking_no ?? 'order (tracking pending)'}`);
						await update();
						open = false;
					} else if (result.type === 'failure') {
						error = String(result.data?.error ?? 'Could not add');
						await update({ reset: false });
					} else {
						await update();
					}
				};
			}}
		>
			<Dialog.Header>
				<Dialog.Title>Add tracking</Dialog.Title>
				<Dialog.Description>One tracking number per entry. Duplicates are rejected.</Dialog.Description>
			</Dialog.Header>

			<label class="flex cursor-pointer items-center gap-2 text-sm">
				<input type="checkbox" name="no_tracking" bind:checked={noTracking} />
				Tracking number not available yet
			</label>

			<div class="grid gap-1.5" hidden={noTracking}>
				<Label for="add-number">Tracking number</Label>
				<Input
					id="add-number"
					name="number"
					required={!noTracking}
					disabled={noTracking}
					autofocus
					autocomplete="off"
					autocapitalize="characters"
					spellcheck={false}
					placeholder="YT2512345678901234"
					class="font-mono"
					aria-invalid={error ? 'true' : undefined}
				/>
			</div>

			<div class="grid gap-1.5">
				<Label for="add-ordered_at">Ordered on</Label>
				<Input id="add-ordered_at" name="ordered_at" type="date" value={todayInput()} max={todayInput()} required />
			</div>

			<div class="grid gap-1.5">
				<Label for="add-comment">
					Comment
					{#if noTracking}
						<span class="text-destructive font-normal">(required, so you can recognise this order)</span>
					{:else}
						<span class="text-muted-foreground font-normal">(optional)</span>
					{/if}
				</Label>
				<Textarea
					id="add-comment"
					name="comment"
					rows={2}
					maxlength={2000}
					required={noTracking}
					placeholder={noTracking ? 'e.g. 20x blue phone cases from Shenzhen Longwin' : 'What is it, who sent it…'}
				/>
			</div>

			{#if error}
				<p class="text-destructive text-sm">{error}</p>
			{/if}

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add'}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
