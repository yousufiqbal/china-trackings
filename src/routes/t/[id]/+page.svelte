<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import EditDialog from '$lib/components/edit-dialog.svelte';
	import AdvanceDialog from '$lib/components/advance-dialog.svelte';
	import CommentDialog from '$lib/components/comment-dialog.svelte';
	import PhotoDropzone from '$lib/components/photo-dropzone.svelte';
	import {
		STATUSES,
		STATUS_LABEL,
		STATUS_HINT,
		NEXT_STATUS,
		daysInStatus,
		formatDate,
		isStale,
		type Status,
		type Tracking
	} from '$lib/trackings';
	import { cn } from '$lib/utils';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import CheckIcon from '@lucide/svelte/icons/check';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';

	let { data } = $props();

	let t = $derived(data.tracking);
	let stale = $derived(isStale(t, data.now));
	let next = $derived(NEXT_STATUS[t.status]);
	let days = $derived(daysInStatus(t, data.now));

	let editOpen = $state(false);
	let statusOpen = $state(false);
	let confirmDelete = $state(false);
	let advanceTarget = $state<Tracking | null>(null);
	let commentTarget = $state<Tracking | null>(null);

	const steps: Status[] = ['ordered', 'warehoused', 'delivered'];
	let stepDates = $derived([t.ordered_at, t.warehoused_at, t.delivered_at]);
	/** Index of the furthest step reached on the happy path. */
	let reached = $derived(t.status === 'lost' ? (t.warehoused_at ? 1 : 0) : steps.indexOf(t.status));
	let lost = $derived(t.status === 'lost');

	async function copy() {
		try {
			await navigator.clipboard.writeText(t.tracking_no);
			toast.success('Copied');
		} catch {
			toast.error('Could not copy');
		}
	}

	const selectClass =
		'border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs focus-visible:ring-ring/50 focus-visible:ring-3 outline-none';
</script>

<svelte:head><title>{t.tracking_no} · Trackings</title></svelte:head>

<div class="grid min-w-0 gap-6">
	<!-- Header -->
	<div>
		<a href="/" class="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm">
			<ArrowLeftIcon class="size-4" /> All parcels
		</a>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="min-w-0">
				<div class="flex items-center gap-1">
					<h1 class="font-mono text-xl font-semibold break-all sm:text-2xl">{t.tracking_no}</h1>
					<Button variant="ghost" size="icon-sm" onclick={copy} aria-label="Copy tracking number">
						<CopyIcon />
					</Button>
				</div>
				<button
					type="button"
					class={cn(
						'mt-1 flex max-w-prose items-start gap-1.5 text-left text-sm',
						t.notes ? 'text-foreground/80' : 'text-muted-foreground'
					)}
					onclick={() => (commentTarget = t)}
				>
					<MessageSquareIcon class="mt-0.5 size-3.5 shrink-0 opacity-60" />
					<span class="whitespace-pre-wrap">{t.notes || 'Add comment'}</span>
				</button>
				<div class="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
					<StatusBadge status={t.status} />
					<span class="text-muted-foreground">{days} day{days === 1 ? '' : 's'} in this status</span>
					{#if stale}
						<span class="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
							<TriangleAlertIcon class="size-3.5" /> stuck too long
						</span>
					{/if}
				</div>
			</div>

			<div class="flex shrink-0 items-center gap-2">
				{#if next}
					<Button class="flex-1 sm:flex-none" onclick={() => (advanceTarget = t)}>
						Mark {STATUS_LABEL[next].toLowerCase()}
						<ArrowRightIcon />
					</Button>
				{/if}
				<Button variant="outline" class="flex-1 sm:flex-none" onclick={() => (editOpen = true)}>
					<PencilIcon /> Edit
				</Button>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="outline" size="icon" aria-label="More">
								<EllipsisIcon />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-48">
						<DropdownMenu.Item onSelect={() => (statusOpen = true)}>
							<RefreshCwIcon /> Change status
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Item variant="destructive" onSelect={() => (confirmDelete = true)}>
							<Trash2Icon /> Delete
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>
	</div>

	{#if lost}
		<div class="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
			<TriangleAlertIcon class="mt-0.5 size-4 shrink-0" />
			<span>Marked as lost. Use <strong>Change status</strong> if it turns up.</span>
		</div>
	{/if}

	<!-- Progress stepper -->
	<Card.Root>
		<Card.Content class="pt-6">
			<ol class="grid grid-cols-3">
				{#each steps as s, i (s)}
					{@const done = !lost && i <= reached}
					{@const current = !lost && i === reached && i < 2}
					{@const partial = lost && i <= reached}
					<li class="relative min-w-0">
						{#if i < steps.length - 1}
							<div
								class={cn(
									'absolute top-3.5 left-[calc(50%+18px)] h-0.5 w-[calc(100%-36px)]',
									!lost && i < reached ? 'bg-primary' : 'bg-border'
								)}
							></div>
						{/if}
						<div class="flex flex-col items-center gap-2 text-center">
							<span
								class={cn(
									'flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
									done
										? 'border-primary bg-primary text-primary-foreground'
										: 'border-border bg-background text-muted-foreground',
									partial && 'border-red-400 bg-red-400/10 text-red-600 dark:text-red-300',
									current && 'ring-primary/20 ring-4'
								)}
							>
								{#if done && !current}<CheckIcon class="size-3.5" />{:else}{i + 1}{/if}
							</span>
							<div class="min-w-0 px-1">
								<div class={cn('text-xs font-medium sm:text-sm', !done && !partial && 'text-muted-foreground')}>
									{STATUS_LABEL[s]}
								</div>
								<div class="text-muted-foreground text-[11px] sm:text-xs">
									{stepDates[i] ? formatDate(stepDates[i]) : current ? 'in progress' : '—'}
								</div>
							</div>
						</div>
					</li>
				{/each}
			</ol>
		</Card.Content>
	</Card.Root>

	<!-- Receipt photo -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">Receipt photo</Card.Title>
			<Card.Description>
				Photo of the warehouse receipt. Drag &amp; drop, paste, or pick a file.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<PhotoDropzone photoId={t.receipt_photo_id} willWarehouse={t.status === 'ordered'} />
		</Card.Content>
	</Card.Root>
</div>

<EditDialog bind:open={editOpen} tracking={t} />
<AdvanceDialog bind:tracking={advanceTarget} onDone={() => invalidateAll()} />
<CommentDialog bind:tracking={commentTarget} onDone={() => invalidateAll()} />

<!-- Change status (manual override) -->
<Dialog.Root bind:open={statusOpen}>
	<Dialog.Content class="sm:max-w-sm">
		<form
			method="POST"
			action="?/status"
			class="grid gap-4"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						toast.success('Status updated');
						statusOpen = false;
					} else if (result.type === 'failure') {
						toast.error(String(result.data?.error ?? 'Failed'));
					}
					await update();
				};
			}}
		>
			<Dialog.Header>
				<Dialog.Title>Change status</Dialog.Title>
				<Dialog.Description>For corrections. Normal flow uses the "Mark …" button.</Dialog.Description>
			</Dialog.Header>
			<div class="grid gap-1.5">
				<Label for="status">Status</Label>
				<select id="status" name="status" class={selectClass} value={t.status}>
					{#each STATUSES as s (s)}
						<option value={s} title={STATUS_HINT[s]}>{STATUS_LABEL[s]}</option>
					{/each}
				</select>
			</div>
			<div class="grid gap-1.5">
				<Label for="note">Reason</Label>
				<Input id="note" name="note" placeholder="Optional" />
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (statusOpen = false)}>Cancel</Button>
				<Button type="submit">Update</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={confirmDelete}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete {t.tracking_no}?</AlertDialog.Title>
			<AlertDialog.Description>
				Removes the tracking, its history and receipt photo. Cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<form method="POST" action="?/delete">
				<AlertDialog.Action type="submit" class="bg-destructive hover:bg-destructive/90 w-full text-white">
					Delete
				</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
