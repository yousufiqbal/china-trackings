<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { shrinkPhotoField } from '$lib/resize-image';
	import { NEXT_STATUS, STATUS_LABEL, todayInput, type Tracking } from '$lib/trackings';

	let {
		tracking = $bindable(null),
		onDone
	}: { tracking: Tracking | null; onDone?: () => void } = $props();

	let submitting = $state(false);
	let open = $derived(tracking !== null);
	let next = $derived(tracking ? NEXT_STATUS[tracking.status] : undefined);
</script>

<Dialog.Root
	{open}
	onOpenChange={(v) => {
		if (!v) tracking = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		{#if tracking && next}
			<form
				method="POST"
				action="?/advance"
				enctype="multipart/form-data"
				class="grid gap-4"
				use:enhance={async ({ formData }) => {
					submitting = true;
					await shrinkPhotoField(formData);
					return async ({ result, update }) => {
						submitting = false;
						if (result.type === 'success') {
							toast.success(`${tracking?.tracking_no} marked ${STATUS_LABEL[next!].toLowerCase()}`);
							tracking = null;
							onDone?.();
						} else if (result.type === 'failure') {
							toast.error(String(result.data?.error ?? 'Something went wrong'));
						}
						await update({ reset: false });
					};
				}}
			>
				<input type="hidden" name="id" value={tracking.id} />
				<Dialog.Header>
					<Dialog.Title>
						{next === 'warehoused' ? 'Received at warehouse' : 'Delivered to you'}
					</Dialog.Title>
					<Dialog.Description>
						<span class="font-mono">{tracking.tracking_no}</span>
						{#if tracking.description}
							· {tracking.description}
						{/if}
					</Dialog.Description>
				</Dialog.Header>

				<div class="grid gap-2">
					<Label for="adv-at">{next === 'warehoused' ? 'Received on' : 'Delivered on'}</Label>
					<Input id="adv-at" name="at" type="date" value={todayInput()} max={todayInput()} required />
				</div>

				{#if next === 'warehoused'}
					<div class="grid gap-2">
						<Label for="receipt_ref">Warehouse receipt no.</Label>
						<Input
							id="receipt_ref"
							name="receipt_ref"
							placeholder="Optional"
							value={tracking.receipt_ref ?? ''}
						/>
					</div>
					<div class="grid gap-2">
						<Label for="photo">Receipt photo</Label>
						<Input id="photo" name="photo" type="file" accept="image/*" capture="environment" />
						<p class="text-muted-foreground text-xs">JPG, PNG, WEBP or HEIC · resized automatically</p>
					</div>
				{:else}
					<p class="text-muted-foreground text-sm">Confirms the parcel arrived at your house and closes the tracking.</p>
				{/if}

				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (tracking = null)}>Cancel</Button>
					<Button type="submit" disabled={submitting}>
						{submitting ? 'Saving…' : next === 'warehoused' ? 'Mark warehoused' : 'Mark delivered'}
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
