<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import AddDialog from '$lib/components/add-dialog.svelte';
	import AdvanceDialog from '$lib/components/advance-dialog.svelte';
	import CommentDialog from '$lib/components/comment-dialog.svelte';
	import EditDialog from '$lib/components/edit-dialog.svelte';
	import RowActions from '$lib/components/row-actions.svelte';
	import {
		STATUS_LABEL,
		STALE_AFTER_DAYS,
		daysInStatus,
		formatDate,
		isStale,
		statusSince,
		type Status,
		type Tracking
	} from '$lib/trackings';
	import { cn } from '$lib/utils';
	import { openLightbox } from '$lib/lightbox.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import XIcon from '@lucide/svelte/icons/x';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import ImageIcon from '@lucide/svelte/icons/image';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	let advanceTarget = $state<Tracking | null>(null);
	let commentTarget = $state<Tracking | null>(null);
	let editTarget = $state<Tracking | null>(null);
	let showReceipt = $derived(data.filter.status !== 'ordered' || !!data.filter.q);
	let addOpen = $state(false);
	let logoutForm = $state<HTMLFormElement | null>(null);
	// svelte-ignore state_referenced_locally
	let q = $state(data.filter.q);


	let staleCount = $derived(data.trackings.filter((t) => isStale(t, data.now)).length);
	let activeCount = $derived(data.counts.ordered + data.counts.warehoused);

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

	function clearSearch() {
		q = '';
		goto(filterHref(data.filter.status));
	}

	const DATE_HEAD: Record<Status, string> = {
		ordered: 'Ordered on',
		warehoused: 'Warehoused on',
		delivered: 'Delivered on',
		lost: 'Lost on'
	};
	let dateHead = $derived(data.filter.q ? 'Status date' : DATE_HEAD[data.filter.status as Status]);

	// Same hues as StatusBadge, for the mobile bottom nav.
	const NAV_COUNT: Record<Status, string> = {
		ordered: 'text-blue-600 dark:text-blue-300',
		warehoused: 'text-amber-600 dark:text-amber-300',
		delivered: 'text-emerald-600 dark:text-emerald-300',
		lost: 'text-red-600 dark:text-red-300'
	};
	const NAV_ACTIVE: Record<Status, string> = {
		ordered: 'border-blue-500 bg-blue-500/10 text-blue-800 dark:text-blue-200',
		warehoused: 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-200',
		delivered: 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
		lost: 'border-red-500 bg-red-500/10 text-red-800 dark:text-red-200'
	};

	async function copyNo(no: string) {
		try {
			await navigator.clipboard.writeText(no);
			toast.success('Copied ' + no);
		} catch {
			toast.error('Could not copy');
		}
	}

	function ageLabel(t: Tracking) {
		const d = daysInStatus(t, data.now);
		return d === 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`;
	}

	const tiles: { status: Status; hint: string }[] = [
		{ status: 'ordered', hint: 'in transit to warehouse' },
		{ status: 'warehoused', hint: 'waiting at warehouse' },
		{ status: 'delivered', hint: 'completed' },
		{ status: 'lost', hint: 'never arrived' }
	];
</script>

<svelte:head><title>Dashboard · Trackings</title></svelte:head>

<div class="grid min-w-0 gap-6 pb-24 md:pb-0">
	<div class="flex items-center justify-between gap-3">
		<div class="flex min-w-0 items-center gap-3">
			<img src="/icon.svg" alt="" class="size-9 shrink-0 rounded-lg" />
			<div class="min-w-0">
				<h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Trackings</h1>
				<p class="text-muted-foreground truncate text-sm">{activeCount} pending delivery</p>
			</div>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<Button onclick={() => (addOpen = true)}>
				<PlusIcon /> <span class="hidden sm:inline">Add Tracking</span><span class="sm:hidden">Add</span>
			</Button>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="outline" size="icon" aria-label="Menu">
							<EllipsisIcon />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-40">
					<DropdownMenu.Item onSelect={() => logoutForm?.requestSubmit()}>
						<LogOutIcon /> Log out
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
			<form bind:this={logoutForm} method="POST" action="/logout" class="hidden"></form>
		</div>
	</div>

	<!-- Desktop: stat tiles -->
	<section class="hidden gap-3 md:grid md:grid-cols-4">
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
			<Input bind:value={q} placeholder="Search number, comment…" class="pr-8 pl-8" />
			{#if q}
				<button
					type="button"
					class="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5"
					aria-label="Clear search"
					onclick={clearSearch}
				>
					<XIcon class="size-4" />
				</button>
			{/if}
		</form>

		{#if data.filter.q}
			<div class="bg-muted/60 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm">
				<span>
					{data.trackings.length} result{data.trackings.length === 1 ? '' : 's'} for
					<strong>"{data.filter.q}"</strong> across all statuses
				</span>
				<Button variant="outline" size="sm" onclick={clearSearch}>
					<ArrowLeftIcon /> Back to {STATUS_LABEL[data.filter.status as Status]}
				</Button>
			</div>
		{/if}

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
						<Table.Head>{dateHead}</Table.Head>
						{#if showReceipt}<Table.Head>Receipt</Table.Head>{/if}
						<Table.Head>Comment</Table.Head>
						<Table.Head class="text-right">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.trackings as t (t.id)}
						{@const stale = isStale(t, data.now)}
						<Table.Row class={cn(stale && 'bg-amber-500/5')}>
							<Table.Cell class="font-mono text-[13px]">
								<div class="group/no flex items-center gap-1">
									<a href="/t/{t.id}" class="hover:underline">{t.tracking_no}</a>
									<button
										type="button"
										class="text-muted-foreground hover:text-foreground rounded p-1 opacity-0 transition-opacity group-hover/no:opacity-100 focus-visible:opacity-100"
										aria-label="Copy tracking number"
										title="Copy"
										onclick={() => copyNo(t.tracking_no)}
									>
										<CopyIcon class="size-3.5" />
									</button>
								</div>
							</Table.Cell>
							<Table.Cell><StatusBadge status={t.status} /></Table.Cell>
							<Table.Cell class="text-sm tabular-nums whitespace-nowrap">
								<span class={cn(stale && 'font-medium text-amber-700 dark:text-amber-300')}>
									{#if stale}<TriangleAlertIcon class="mr-1 inline size-3" />{/if}
									{formatDate(statusSince(t))}
								</span>
								<div class="text-muted-foreground text-xs">{ageLabel(t)}</div>
							</Table.Cell>
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
							<Table.Cell>
								<RowActions tracking={t} onAdvance={(x) => (advanceTarget = x)} onEdit={(x) => (editTarget = x)} />
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
							<div class="flex items-start gap-1">
								<a href="/t/{t.id}" class="font-mono text-sm font-medium break-all">
									{t.tracking_no}
								</a>
								<button
									type="button"
									class="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5"
									aria-label="Copy tracking number"
									onclick={() => copyNo(t.tracking_no)}
								>
									<CopyIcon class="size-3.5" />
								</button>
							</div>
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
						<RowActions tracking={t} onAdvance={(x) => (advanceTarget = x)} onEdit={(x) => (editTarget = x)} showPrimary={false} />
					</div>
					<div class="mt-3 flex flex-wrap items-center justify-between gap-2">
						<div class="flex min-w-0 flex-wrap items-center gap-2">
							<StatusBadge status={t.status} />
							<span class={cn('text-xs tabular-nums', stale ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
								{#if stale}<TriangleAlertIcon class="mr-0.5 inline size-3" />{/if}
								{formatDate(statusSince(t))}
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

<!-- Mobile bottom navigation -->
<nav
	class="bg-background/95 border-border/60 fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,0.08)] backdrop-blur md:hidden"
	aria-label="Status"
>
	<div class="grid grid-cols-4">
		{#each tiles as tile (tile.status)}
			{@const active = data.filter.status === tile.status}
			<a
				href={filterHref(tile.status)}
				aria-current={active ? 'page' : undefined}
				class={cn(
					'flex flex-col items-center gap-0.5 border-t-2 px-1 py-3 text-center leading-tight transition-colors',
					active ? NAV_ACTIVE[tile.status] : 'text-muted-foreground border-transparent'
				)}
			>
				<span class={cn('text-xl font-semibold tabular-nums', NAV_COUNT[tile.status])}>
					{data.counts[tile.status]}
				</span>
				<span class="text-xs">{STATUS_LABEL[tile.status]}</span>
			</a>
		{/each}
	</div>
</nav>

<AddDialog bind:open={addOpen} />
<AdvanceDialog bind:tracking={advanceTarget} />
<CommentDialog bind:tracking={commentTarget} />
{#if editTarget}
	{#key editTarget.id}
		<EditDialog
			open={true}
			tracking={editTarget}
			onDone={() => (editTarget = null)}
			onClose={() => (editTarget = null)}
		/>
	{/key}
{/if}
