<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { Tracking } from '$lib/trackings';

	let {
		tracking = $bindable(null),
		onDone
	}: { tracking: Tracking | null; onDone?: () => void } = $props();

	let saving = $state(false);
	let error = $state<string | null>(null);
	let open = $derived(tracking !== null);
</script>

<Dialog.Root
	{open}
	onOpenChange={(v) => {
		if (!v) {
			tracking = null;
			error = null;
		}
	}}
>
	<Dialog.Content class="sm:max-w-sm">
		{#if tracking}
			<form
				method="POST"
				action="/?/number"
				class="grid gap-4"
				use:enhance={() => {
					saving = true;
					error = null;
					return async ({ result, update }) => {
						saving = false;
						if (result.type === 'success') {
							toast.success('Tracking number saved');
							tracking = null;
							onDone?.();
							await invalidateAll();
						} else if (result.type === 'failure') {
							error = String(result.data?.error ?? 'Could not save');
						}
						await update({ reset: false });
					};
				}}
			>
				<input type="hidden" name="id" value={tracking.id} />
				<Dialog.Header>
					<Dialog.Title>Add tracking number</Dialog.Title>
					{#if tracking.notes}
						<Dialog.Description>{tracking.notes}</Dialog.Description>
					{/if}
				</Dialog.Header>

				<div class="grid gap-1.5">
					<Label for="tn-number">Tracking number</Label>
					<Input
						id="tn-number"
						name="tracking_no"
						required
						autofocus
						autocomplete="off"
						autocapitalize="characters"
						spellcheck={false}
						placeholder="YT2512345678901234"
						class="font-mono"
						aria-invalid={error ? 'true' : undefined}
					/>
				</div>

				{#if error}
					<p class="text-destructive text-sm">{error}</p>
				{/if}

				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (tracking = null)}>Cancel</Button>
					<Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
