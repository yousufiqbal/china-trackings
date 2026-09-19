<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Separator } from '$lib/components/ui/separator';
	import { shrinkPhotoField } from '$lib/resize-image';
	import { lightbox, openLightbox } from '$lib/lightbox.svelte';
	import { ACTIVE_STATUSES, type Tracking } from '$lib/trackings';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import PackageXIcon from '@lucide/svelte/icons/package-x';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	let {
		open = $bindable(false),
		tracking,
		onDone,
		onClose
	}: { open?: boolean; tracking: Tracking; onDone?: () => void; onClose?: () => void } = $props();

	let saving = $state(false);
	let error = $state<string | null>(null);
	let confirmDelete = $state(false);

	/** Secondary actions live on the dashboard route; call them absolutely so this works from any page. */
	async function post(action: 'lost' | 'reopen' | 'delete') {
		const body = new FormData();
		body.set('id', String(tracking.id));
		const res = await fetch(`/?/${action}`, {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' }
		});
		const result = deserialize(await res.text());
		if (result.type === 'success') {
			toast.success(
				{
					lost: `${tracking.tracking_no} marked lost`,
					reopen: `${tracking.tracking_no} reopened`,
					delete: `${tracking.tracking_no} deleted`
				}[action]
			);
			open = false;
			onDone?.();
			if (action === 'delete' && page.url.pathname.startsWith('/t/')) await goto('/');
			else await invalidateAll();
		} else if (result.type === 'failure') {
			toast.error(String(result.data?.error ?? 'Something went wrong'));
		} else {
			toast.error('Something went wrong');
		}
	}

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
		if (!v) {
			error = null;
			onClose?.();
		}
	}}
>
	<Dialog.Content
		class="max-h-[92dvh] overflow-y-auto sm:max-w-xl"
		onInteractOutside={(e) => {
			// keep the edit dialog open while the lightbox / confirm (rendered outside it) are in use
			if (lightbox.src || confirmDelete) e.preventDefault();
		}}
		onEscapeKeydown={(e) => {
			if (lightbox.src || confirmDelete) e.preventDefault();
		}}
	>
		<!-- key on open so the form re-reads current values each time it opens -->
		{#key open}
			<form
				method="POST"
				action="/?/save"
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
							onDone?.();
						} else if (result.type === 'failure') {
							error = String(result.data?.error ?? 'Could not save');
						} else {
							await update();
						}
					};
				}}
			>
				<input type="hidden" name="id" value={tracking.id} />
				<Dialog.Header class="pr-8">
					<div class="flex items-start justify-between gap-2">
						<div>
							<Dialog.Title>Edit tracking</Dialog.Title>
							<Dialog.Description class="font-mono">{tracking.tracking_no}</Dialog.Description>
						</div>
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								{#snippet child({ props })}
									<Button {...props} type="button" variant="ghost" size="icon-sm" aria-label="More actions">
										<EllipsisIcon />
									</Button>
								{/snippet}
							</DropdownMenu.Trigger>
							<DropdownMenu.Content align="end" class="w-44">
								{#if ACTIVE_STATUSES.includes(tracking.status)}
									<DropdownMenu.Item onSelect={() => post('lost')}>
										<PackageXIcon /> Mark lost
									</DropdownMenu.Item>
								{:else}
									<DropdownMenu.Item onSelect={() => post('reopen')}>
										<RotateCcwIcon /> Reopen
									</DropdownMenu.Item>
								{/if}
								<DropdownMenu.Separator />
								<DropdownMenu.Item variant="destructive" onSelect={() => (confirmDelete = true)}>
									<Trash2Icon /> Delete
								</DropdownMenu.Item>
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					</div>
				</Dialog.Header>

				<div class="grid gap-1.5">
					<Label for="e-tracking_no">Tracking number</Label>
					<Input id="e-tracking_no" name="tracking_no" value={tracking.tracking_no} required class="font-mono" />
				</div>
				<Separator />

				<div class="grid gap-4 sm:grid-cols-2">
					<div class="grid gap-1.5">
						<Label for="e-ordered_at">Ordered</Label>
						<Input id="e-ordered_at" name="ordered_at" type="date" value={toDateInput(tracking.ordered_at)} required />
					</div>
					<div class="grid gap-1.5">
						<Label for="e-delivered_at">Delivered to warehouse</Label>
						<Input id="e-delivered_at" name="delivered_at" type="date" value={toDateInput(tracking.delivered_at)} />
					</div>
					<div class="grid gap-1.5">
						<Label for="e-warehoused_at">Warehoused (receipt)</Label>
						<Input id="e-warehoused_at" name="warehoused_at" type="date" value={toDateInput(tracking.warehoused_at)} />
					</div>
					<div class="grid gap-1.5">
						<Label for="e-received_at">Received at home</Label>
						<Input id="e-received_at" name="received_at" type="date" value={toDateInput(tracking.received_at)} />
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
							<button
								type="button"
								class="shrink-0 cursor-zoom-in rounded-md focus-visible:ring-ring/50 focus-visible:ring-3 outline-none"
								aria-label="View current receipt photo"
								onclick={() => openLightbox(`/photos/${tracking.receipt_photo_id}`)}
							>
								<img
									src="/photos/{tracking.receipt_photo_id}"
									alt="Current receipt"
									class="size-16 rounded-md border object-cover"
								/>
							</button>
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

<AlertDialog.Root bind:open={confirmDelete}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete {tracking.tracking_no}?</AlertDialog.Title>
			<AlertDialog.Description>
				Removes the tracking, its history and receipt photo. Cannot be undone. If the parcel never
				arrived, prefer "Mark lost" so you keep the record.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action class="bg-destructive hover:bg-destructive/90 text-white" onclick={() => post('delete')}>
				Delete
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
