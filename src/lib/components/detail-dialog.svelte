<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import EditDialog from '$lib/components/edit-dialog.svelte';
	import AdvanceDialog from '$lib/components/advance-dialog.svelte';
	import CommentDialog from '$lib/components/comment-dialog.svelte';
	import PhotoDropzone from '$lib/components/photo-dropzone.svelte';
	import TrackingNumberDialog from '$lib/components/tracking-number-dialog.svelte';
	import { lightbox } from '$lib/lightbox.svelte';
	import {
		STATUSES,
		STATUS_LABEL,
		STATUS_HINT,
		NEXT_STATUS,
		daysInStatus,
		formatDate,
		isStale,
		trackingLabel,
		type Status,
		type Tracking
	} from '$lib/trackings';
	import { cn } from '$lib/utils';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import CheckIcon from '@lucide/svelte/icons/check';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

	let {
		tracking,
		open = $bindable(false),
		onClose,
		now = Date.now(),
		showOpenLink = true
	}: {
		tracking: Tracking;
		open?: boolean;
		onClose?: () => void;
		now?: number;
		/** hide the "open page" link when already on /t/[id] */
		showOpenLink?: boolean;
	} = $props();

	let t = $derived(tracking);
	let stale = $derived(isStale(t, now));
	let next = $derived(NEXT_STATUS[t.status]);
	// An order without a tracking number cannot leave Ordered: button shown but disabled.
	let locked = $derived(!t.tracking_no);
	let days = $derived(daysInStatus(t, now));
	let lost = $derived(t.status === 'lost');

	let editOpen = $state(false);
	let statusOpen = $state(false);
	let advanceTarget = $state<Tracking | null>(null);
	let commentTarget = $state<Tracking | null>(null);
	let numberTarget = $state<Tracking | null>(null);

	/** A child dialog / lightbox is up: keep this one open on outside click / Esc. */
	let childOpen = $derived(
		editOpen || statusOpen || advanceTarget !== null || commentTarget !== null || numberTarget !== null || !!lightbox.src
	);

	const steps: Status[] = ['ordered', 'delivered', 'warehoused', 'received'];
	let stepDates = $derived([t.ordered_at, t.delivered_at, t.warehoused_at, t.received_at]);
	let reached = $derived(
		lost ? (t.warehoused_at ? 2 : t.delivered_at ? 1 : 0) : steps.indexOf(t.status)
	);

	async function copy() {
		if (!t.tracking_no) return;
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

<Dialog.Root
	bind:open
	onOpenChange={(v) => {
		if (!v) onClose?.();
	}}
>
	<Dialog.Content
		class="max-h-[94dvh] overflow-y-auto sm:max-w-2xl"
		onInteractOutside={(e) => {
			if (childOpen) e.preventDefault();
		}}
		onEscapeKeydown={(e) => {
			if (childOpen) e.preventDefault();
		}}
	>
		<Dialog.Header class="pr-8 text-left">
			<div class="flex items-center gap-1">
				<Dialog.Title
					class={cn('font-mono text-lg break-all sm:text-xl', !t.tracking_no && 'font-sans text-amber-700 italic dark:text-amber-300')}
				>
					{trackingLabel(t)}
				</Dialog.Title>
				{#if t.tracking_no}
					<Button variant="ghost" size="icon-sm" onclick={copy} aria-label="Copy tracking number">
						<CopyIcon />
					</Button>
				{/if}
				{#if showOpenLink}
					<Button
						variant="ghost"
						size="icon-sm"
						href="/t/{t.id}"
						aria-label="Open as page"
						title="Open as page"
					>
						<ExternalLinkIcon />
					</Button>
				{/if}
			</div>
			<Dialog.Description class="sr-only">Tracking details</Dialog.Description>
			<button
				type="button"
				class={cn(
					'flex max-w-prose items-start gap-1.5 text-left text-sm',
					t.notes ? 'text-foreground/80' : 'text-muted-foreground'
				)}
				onclick={() => (commentTarget = t)}
			>
				<MessageSquareIcon class="mt-0.5 size-3.5 shrink-0 opacity-60" />
				<span class="whitespace-pre-wrap">{t.notes || 'Add comment'}</span>
			</button>
			<div class="flex flex-wrap items-center gap-2 text-sm">
				<StatusBadge status={t.status} />
				<span class="text-muted-foreground">{days} day{days === 1 ? '' : 's'} in this status</span>
				{#if stale}
					<span class="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
						<TriangleAlertIcon class="size-3.5" /> stuck too long
					</span>
				{/if}
			</div>
		</Dialog.Header>

		<!-- Actions -->
		<div class="flex flex-wrap items-center gap-2">
			{#if next}
				<Button
					class="flex-1 sm:flex-none"
					disabled={locked}
					title={locked ? 'Add the tracking number first' : undefined}
					onclick={() => (advanceTarget = t)}
				>
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
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>

		{#if !t.tracking_no}
			<div
				class="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
			>
				<TriangleAlertIcon class="mt-0.5 size-4 shrink-0" />
				<span class="flex-1">No tracking number yet.</span>
				<Button size="sm" variant="outline" onclick={() => (numberTarget = t)}>Add number</Button>
			</div>
		{/if}

		{#if lost}
			<div
				class="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
			>
				<TriangleAlertIcon class="mt-0.5 size-4 shrink-0" />
				<span>Marked as lost. Use <strong>Change status</strong> if it turns up.</span>
			</div>
		{/if}

		<!-- Progress stepper -->
		<ol class="grid grid-cols-4 rounded-lg border py-4">
			{#each steps as s, i (s)}
				{@const done = !lost && i <= reached}
				{@const current = !lost && i === reached && i < steps.length - 1}
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
							<div class={cn('text-xs font-medium', !done && !partial && 'text-muted-foreground')}>
								{STATUS_LABEL[s]}
							</div>
							<div class="text-muted-foreground text-[11px]">
								{stepDates[i] ? formatDate(stepDates[i]) : current ? 'in progress' : '—'}
							</div>
						</div>
					</div>
				</li>
			{/each}
		</ol>

		<!-- Receipt photo -->
		<div class="grid gap-2">
			<div>
				<h3 class="text-sm font-medium">Receipt photo</h3>
				<p class="text-muted-foreground text-xs">
					{#if t.receipt_ref}Receipt no. <span class="font-mono">{t.receipt_ref}</span> · {/if}
					Drag &amp; drop, paste, or pick a file.
				</p>
			</div>
			{#if t.tracking_no}
				<PhotoDropzone
					trackingId={t.id}
					photoId={t.receipt_photo_id}
					willWarehouse={t.status === 'ordered' || t.status === 'delivered'}
				/>
			{:else}
				<p class="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
					Available once the tracking number is added.
				</p>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>

{#if editOpen}
	<EditDialog open={true} tracking={t} onClose={() => (editOpen = false)} onDone={() => (editOpen = false)} />
{/if}
<AdvanceDialog bind:tracking={advanceTarget} onDone={() => invalidateAll()} />
<CommentDialog bind:tracking={commentTarget} onDone={() => invalidateAll()} />
<TrackingNumberDialog bind:tracking={numberTarget} />

<!-- Change status (manual override) -->
<Dialog.Root bind:open={statusOpen}>
	<Dialog.Content class="sm:max-w-sm">
		<form
			method="POST"
			action="/?/status"
			class="grid gap-4"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						toast.success('Status updated');
						statusOpen = false;
						await invalidateAll();
					} else if (result.type === 'failure') {
						toast.error(String(result.data?.error ?? 'Failed'));
					}
					await update({ reset: false });
				};
			}}
		>
			<input type="hidden" name="id" value={t.id} />
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
