<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import AddDialog from '$lib/components/add-dialog.svelte';
	import AdvanceDialog from '$lib/components/advance-dialog.svelte';
	import CommentDialog from '$lib/components/comment-dialog.svelte';
	import RowActions from '$lib/components/row-actions.svelte';
	import {
		STATUS_LABEL,
		STALE_AFTER_DAYS,
		daysInStatus,
		formatDate,
		isStale,
		type Status,
		type Tracking
	} from '$lib/trackings';
	import { cn } from '$lib/utils';
	import { openLightbox } from '$lib/lightbox.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import ImageIcon from '@lucide/svelte/icons/image';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';

	let { data } = $props();

	let advanceTarget = $state<Tracking | null>(null);
	let commentTarget = $state<Tracking | null>(null);
	let showReceipt = $derived(data.filter.status !== 'ordered');
	let addOpen = $state(false);
	// svelte-ignore state_referenced_locally
	let q = $state(data.filter.q);


	let staleCount = $derived(data.trackings.filter((t) => isStale(t, data.now)).length);
	let activeCount = $derived(data.counts.ordered + data.counts.warehoused);
	let totalCount = $derived(activeCount + data.counts.delivered + data.counts.lost);

	function filterHref(status: string) {
		const p = new URLSearchParams();
		if (status !== 'ordered') p.set('status', status);
		if (data.filter.q) p.set('q', data.filter.q);
		const s = p.toString();
		return s ? `/?${s}` : '/';
	}

	function search(e: SubmitEvent) {
		e.preventDefault();
		const p = new URLSearchParams();
		if (data.filter.status !== 'ordered') p.set('status', data.filter.status);
		if (q.trim()) p.set('q', q.trim());
		const s = p.toString();
		goto(s ? `/?${s}` : '/', { keepFocus: true });
	}

	function ageLabel(t: Tracking) {
		const d = daysInStatus(t, data.now);
		return d === 0 ? 'today' : d === 1 ? '1 day' : `${d} days`;
	}

	const tiles: { status: Status; hint: string }[] = [
		{ status: 'ordered', hint: 'in transit to warehouse' },
		{ status: 'warehoused', hint: 'waiting at warehouse' },
		{ status: 'delivered', hint: 'completed' },
		{ status: 'lost', hint: 'never arrived' }
	];
</script>

<svelte:head><title>Dashboard · Trackings</title></svelte:head>

<div class="grid min-w-0 gap-6">
	<div class="flex items-center justify-between gap-3">
		<div>
			<h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Parcels</h1>
			<p class="text-muted-foreground text-sm">{activeCount} still on the way, {totalCount} total</p>
		</div>
		<Button onclick={() => (addOpen = true)}>
			<PlusIcon /> Add
		</Button>
	</div>

	<!-- Stat tiles -->
	<section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		{#each tiles as tile (tile.status)}
			<a
				href={filterHref(tile.status)}
				aria-current={data.filter.status === tile.status ? 'page' : undefined}
				class={cn(
					'bg-card hover:bg-accent/40 rounded-xl border p-4 transition-colors',
					data.filter.status === tile.status && 'border-primary ring-primary/20 ring-2'
				)}
			>
				<div class="flex items-center justify-between gap-2">
					<span class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
						{STATUS_LABEL[tile.status]}
					</span>
					<StatusBadge status={tile.status} class="hidden sm:inline-flex" />
				</div>
				<div class="mt-2 text-3xl font-semibold tabular-nums">{data.counts[tile.status]}</div>
				<div class="text-muted-foreground mt-1 text-xs">{tile.hint}</div>
			</a>
		{/each}
	</section>

	<!-- Search -->
	<section class="grid min-w-0 gap-3">
		<form onsubmit={search} class="relative sm:ml-auto sm:w-72">
			<SearchIcon class="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
			<Input bind:value={q} placeholder="Search number, comment…" class="pl-8" />
		</form>

		{#if staleCount > 0}
			<div
				class="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
			>
				<TriangleAlertIcon class="mt-0.5 size-4 shrink-0" />
				<span>
					<strong>{staleCount}</strong> parcel{staleCount === 1 ? '' : 's'} stuck too long — ordered &gt;
					{STALE_AFTER_DAYS.ordered}d or warehoused &gt; {STALE_AFTER_DAYS.warehoused}d. Chase supplier / warehouse.
				</span>
			</div>
		{/if}
	</section>

	<!-- List -->
	{#if data.trackings.length === 0}
		<div class="text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">
			{data.filter.q ? 'No trackings match your search.' : 'Nothing here yet.'}
		</div>
	{:else}
		<!-- Desktop table -->
		<div class="bg-card hidden overflow-hidden rounded-xl border md:block">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Tracking no.</Table.Head>
						<Table.Head>Status</Table.Head>
						{#if showReceipt}<Table.Head>Receipt</Table.Head>{/if}
						<Table.Head>Comment</Table.Head>
						<Table.Head class="text-right">In status</Table.Head>
						<Table.Head class="text-right">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.trackings as t (t.id)}
						{@const stale = isStale(t, data.now)}
						<Table.Row class={cn(stale && 'bg-amber-500/5')}>
							<Table.Cell class="font-mono text-[13px]">
								<a href="/t/{t.id}" class="hover:underline">{t.tracking_no}</a>
							</Table.Cell>
							<Table.Cell><StatusBadge status={t.status} /></Table.Cell>
							{#if showReceipt}
							<Table.Cell class="text-muted-foreground text-xs">
								<div class="flex items-center gap-1.5">
									{#if t.receipt_photo_id}
										<button
											type="button"
											class="hover:text-foreground"
											title="Receipt photo"
											aria-label="View receipt photo"
											onclick={() => openLightbox(`/photos/${t.receipt_photo_id}`)}
										>
											<ImageIcon class="size-4" />
										</button>
									{/if}
									<span class="font-mono">{t.receipt_ref ?? ''}</span>
								</div>
							</Table.Cell>
							{/if}
							<Table.Cell class="max-w-[320px] p-0">
								<button
									type="button"
									class={cn(
										'hover:bg-accent/60 flex h-full w-full items-start gap-2 px-2 py-2 text-left text-sm transition-colors',
										!t.notes && 'text-muted-foreground'
									)}
									title={t.notes ?? 'Add comment'}
									onclick={() => (commentTarget = t)}
								>
									<MessageSquareIcon class="mt-0.5 size-3.5 shrink-0 opacity-60" />
									<span class="line-clamp-2 min-w-0 break-words">{t.notes || 'Add comment'}</span>
								</button>
							</Table.Cell>
							<Table.Cell class="text-right text-xs tabular-nums">
								<span class={cn(stale && 'font-medium text-amber-700 dark:text-amber-300')}>
									{#if stale}<TriangleAlertIcon class="mr-1 inline size-3" />{/if}
									{ageLabel(t)}
								</span>
								<div class="text-muted-foreground">{formatDate(t.ordered_at)}</div>
							</Table.Cell>
							<Table.Cell>
								<RowActions tracking={t} onAdvance={(x) => (advanceTarget = x)} />
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<!-- Mobile cards -->
		<ul class="grid min-w-0 gap-3 md:hidden">
			{#each data.trackings as t (t.id)}
				{@const stale = isStale(t, data.now)}
				<li class={cn('bg-card min-w-0 rounded-xl border p-4', stale && 'border-amber-500/40 bg-amber-500/5')}>
					<div class="flex items-start justify-between gap-3">
						<div class="flex min-w-0 gap-2">
							<div class="min-w-0">
							<a href="/t/{t.id}" class="block font-mono text-sm font-medium break-all">
								{t.tracking_no}
							</a>
							<button
								type="button"
								class={cn('mt-0.5 flex items-start gap-1 text-left text-xs', t.notes ? 'text-foreground/80' : 'text-muted-foreground')}
								onclick={() => (commentTarget = t)}
							>
								<MessageSquareIcon class="mt-0.5 size-3 shrink-0 opacity-60" />
								<span class="line-clamp-2 break-words">{t.notes || 'Add comment'}</span>
							</button>
							</div>
						</div>
						<RowActions tracking={t} onAdvance={(x) => (advanceTarget = x)} showPrimary={false} />
					</div>
					<div class="mt-3 flex flex-wrap items-center justify-between gap-2">
						<div class="flex min-w-0 flex-wrap items-center gap-2">
							<StatusBadge status={t.status} />
							<span class={cn('text-xs tabular-nums', stale ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
								{#if stale}<TriangleAlertIcon class="mr-0.5 inline size-3" />{/if}
								{ageLabel(t)}
							</span>
							{#if t.receipt_photo_id}
								<button
									type="button"
									class="text-muted-foreground hover:text-foreground"
									aria-label="View receipt photo"
									onclick={() => openLightbox(`/photos/${t.receipt_photo_id}`)}
								>
									<ImageIcon class="size-4" />
								</button>
							{/if}
						</div>
						{#if t.status === 'ordered' || t.status === 'warehoused'}
							<Button size="sm" variant="outline" onclick={() => (advanceTarget = t)}>
								{t.status === 'ordered' ? 'Warehoused' : 'Delivered'}
							</Button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<AddDialog bind:open={addOpen} />
<AdvanceDialog bind:tracking={advanceTarget} />
<CommentDialog bind:tracking={commentTarget} />
