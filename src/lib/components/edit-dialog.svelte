<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Separator } from '$lib/components/ui/separator';
	import { shrinkPhotoField } from '$lib/resize-image';
	import type { Tracking } from '$lib/trackings';

	let { open = $bindable(false), tracking }: { open?: boolean; tracking: Tracking } = $props();

	let saving = $state(false);
	let error = $state<string | null>(null);

	function toDateInput(ms: number | null): string {
		if (!ms) return '';
		const d = new Date(ms);
		const p = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
	}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(v) => {
		if (!v) error = null;
	}}
>
	<Dialog.Content class="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
		<!-- key on open so the form re-reads current values each time it opens -->
		{#key open}
			<form
				method="POST"
				action="?/save"
				enctype="multipart/form-data"
				class="grid gap-4"
				use:enhance={async ({ formData }) => {
					saving = true;
					error = null;
					await shrinkPhotoField(formData);
					return async ({ result, update }) => {
						saving = false;
						if (result.type === 'success') {
							toast.success('Saved');
							await update({ reset: false });
							open = false;
						} else if (result.type === 'failure') {
							error = String(result.data?.error ?? 'Could not save');
						} else {
							await update();
						}
					};
				}}
			>
				<Dialog.Header>
					<Dialog.Title>Edit tracking</Dialog.Title>
					<Dialog.Description class="font-mono">{tracking.tracking_no}</Dialog.Description>
				</Dialog.Header>

				<div class="grid gap-1.5">
					<Label for="e-tracking_no">Tracking number</Label>
					<Input id="e-tracking_no" name="tracking_no" value={tracking.tracking_no} required class="font-mono" />
				</div>
				<Separator />

				<div class="grid gap-4 sm:grid-cols-3">
					<div class="grid gap-1.5">
						<Label for="e-ordered_at">Ordered</Label>
						<Input id="e-ordered_at" name="ordered_at" type="date" value={toDateInput(tracking.ordered_at)} required />
					</div>
					<div class="grid gap-1.5">
						<Label for="e-warehoused_at">Warehoused</Label>
						<Input id="e-warehoused_at" name="warehoused_at" type="date" value={toDateInput(tracking.warehoused_at)} />
					</div>
					<div class="grid gap-1.5">
						<Label for="e-delivered_at">Delivered</Label>
						<Input id="e-delivered_at" name="delivered_at" type="date" value={toDateInput(tracking.delivered_at)} />
					</div>
				</div>

				<Separator />

				<div class="grid gap-1.5">
					<Label for="e-receipt_ref">Warehouse receipt no.</Label>
					<Input id="e-receipt_ref" name="receipt_ref" value={tracking.receipt_ref ?? ''} class="font-mono" />
				</div>

				<div class="grid gap-2">
					<Label for="e-photo">Receipt photo</Label>
					{#if tracking.receipt_photo_id}
						<div class="flex items-center gap-3">
							<img
								src="/photos/{tracking.receipt_photo_id}"
								alt="Current receipt"
								class="size-16 rounded-md border object-cover"
							/>
							<label class="text-muted-foreground flex items-center gap-2 text-xs">
								<input type="checkbox" name="remove_photo" class="rounded" /> Remove current photo
							</label>
						</div>
					{/if}
					<Input id="e-photo" name="photo" type="file" accept="image/*" capture="environment" />
					<p class="text-muted-foreground text-xs">
						{tracking.receipt_photo_id ? 'Choosing a new file replaces the current photo.' : 'JPG, PNG, WEBP or HEIC, resized automatically'}
					</p>
				</div>

				<div class="grid gap-1.5">
					<Label for="e-notes">Comment</Label>
					<Textarea id="e-notes" name="notes" rows={3} maxlength={2000} value={tracking.notes ?? ''} />
				</div>

				{#if error}
					<p class="text-destructive text-sm">{error}</p>
				{/if}

				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
					<Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
				</Dialog.Footer>
			</form>
		{/key}
	</Dialog.Content>
</Dialog.Root>
