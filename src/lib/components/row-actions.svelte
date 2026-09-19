<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import { NEXT_STATUS, STATUS_LABEL, type Tracking } from '$lib/trackings';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PackageXIcon from '@lucide/svelte/icons/package-x';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';

	let {
		tracking,
		onAdvance,
		onEdit,
		showPrimary = true
	}: {
		tracking: Tracking;
		onAdvance: (t: Tracking) => void;
		onEdit: (t: Tracking) => void;
		showPrimary?: boolean;
	} = $props();

	let confirmDelete = $state(false);
	let next = $derived(NEXT_STATUS[tracking.status]);

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
			const msg = {
				lost: `${tracking.tracking_no} marked lost`,
				reopen: `${tracking.tracking_no} reopened`,
				delete: `${tracking.tracking_no} deleted`
			}[action];
			toast.success(msg);
			await invalidateAll();
		} else if (result.type === 'failure') {
			toast.error(String(result.data?.error ?? 'Something went wrong'));
		} else if (result.type === 'error') {
			toast.error(result.error?.message ?? 'Something went wrong');
		}
	}
</script>

<div class="flex items-center justify-end gap-1">
	{#if showPrimary && next}
		<Button size="sm" variant="outline" onclick={() => onAdvance(tracking)}>
			{next === 'warehoused' ? 'Warehoused' : 'Delivered'}
			<ArrowRightIcon />
		</Button>
	{/if}

	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon-sm" aria-label="More actions">
					<EllipsisIcon />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-44">
			<DropdownMenu.Item onSelect={() => onEdit(tracking)}>
				<PencilIcon /> Edit
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			{#if tracking.status === 'ordered' || tracking.status === 'warehoused'}
				<DropdownMenu.Item onSelect={() => post('lost')}>
					<PackageXIcon /> Mark lost
				</DropdownMenu.Item>
			{:else}
				<DropdownMenu.Item onSelect={() => post('reopen')}>
					<RotateCcwIcon /> Reopen
				</DropdownMenu.Item>
			{/if}
			<DropdownMenu.Item variant="destructive" onSelect={() => (confirmDelete = true)}>
				<Trash2Icon /> Delete
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>

<AlertDialog.Root bind:open={confirmDelete}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete {tracking.tracking_no}?</AlertDialog.Title>
			<AlertDialog.Description>
				This removes the tracking, its history and receipt photo. Cannot be undone. If the parcel
				never arrived, prefer "Mark lost" so you keep the record.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-white hover:bg-destructive/90"
				onclick={() => post('delete')}
			>
				Delete
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
