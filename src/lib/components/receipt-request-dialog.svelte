<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { daysInStatus, formatDate, isStale, STALE_AFTER_DAYS, trackingLabel, type Tracking } from '$lib/trackings';
	import Flag from '$lib/components/flag.svelte';
	import { cn } from '$lib/utils';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckIcon from '@lucide/svelte/icons/check';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	let {
		open = $bindable(false),
		trackings,
		now = Date.now(),
		tz
	}: {
		open?: boolean;
		/** Delivered parcels (at warehouse, receipt pending). */
		trackings: Tracking[];
		now?: number;
		/** user's UTC offset in minutes (from layout data) */
		tz?: number;
	} = $props();

	let picked = $state<Set<number>>(new Set());
	let copied = $state(false);
	/** Row index of the last click, for shift-click range selection. */
	let anchor = $state<number | null>(null);

	const deliveredAt = (t: Tracking) => t.delivered_at ?? t.updated_at;
	const longDate = (ms: number) =>
		new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

	// Oldest first: the ones waiting longest are the ones to chase.
	let rows = $derived([...trackings].sort((a, b) => deliveredAt(a) - deliveredAt(b)));
	let overdue = $derived(rows.filter((t) => isStale(t, now, tz)));
	let included = $derived(rows.filter((t) => picked.has(t.id)));
	let allPicked = $derived(rows.length > 0 && included.length === rows.length);

	let message = $derived.by(() => {
		if (!included.length) return '';
		const blocks = included.map((t) => {
			const label = t.tracking_no ?? `[no tracking] ${t.notes ?? ''}`.trim();
			return `${label}\nDelivered on ${longDate(deliveredAt(t))}`;
		});
		const intro = 'Assalamualaekum,\nReceipts are required for the following trackings:';
		return [intro, ...blocks, 'JazakAllah.'].join('\n\n');
	});

	function pick(index: number, range: boolean) {
		const next = new Set(picked);
		const on = !next.has(rows[index].id);
		const [from, to] = range && anchor !== null ? [Math.min(anchor, index), Math.max(anchor, index)] : [index, index];
		for (let i = from; i <= to; i++) {
			if (on) next.add(rows[i].id);
			else next.delete(rows[i].id);
		}
		picked = next;
		anchor = index;
	}

	function select(list: Tracking[]) {
		picked = new Set(list.map((t) => t.id));
		anchor = null;
	}

	function ageLabel(t: Tracking) {
		const d = daysInStatus(t, now, tz);
		return d === 0 ? 'today' : `${d}d`;
	}

	async function copyMessage() {
		if (!message) return;
		try {
			await navigator.clipboard.writeText(message);
			copied = true;
			toast.success('Message copied');
			setTimeout(() => (copied = false), 2000);
		} catch {
			toast.error('Could not copy');
		}
	}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(v) => {
		if (v) {
			picked = new Set();
			anchor = null;
			copied = false;
		}
	}}
>
	<Dialog.Content class="flex max-h-[92dvh] flex-col gap-4 sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Request receipts</Dialog.Title>
			<Dialog.Description>Pick the delivered parcels to ask your forwarder about.</Dialog.Description>
		</Dialog.Header>

		{#if !rows.length}
			<p class="text-muted-foreground py-6 text-center text-sm">No delivered parcels waiting for a receipt.</p>
		{:else}
			<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
				<!-- Selection -->
				<section class="grid gap-2">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<h3 class="text-sm font-medium">
							Parcels
							<span class="text-muted-foreground font-normal tabular-nums">
								· {included.length} of {rows.length} selected
							</span>
						</h3>
						<div class="flex flex-wrap gap-1.5">
							<button
								type="button"
								class={cn(
									'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
									allPicked ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
								)}
								onclick={() => select(rows)}
							>
								All
							</button>
							{#if overdue.length}
								<button
									type="button"
									class="rounded-full border border-amber-500/40 px-2.5 py-0.5 text-xs text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-300"
									onclick={() => select(overdue)}
								>
									Overdue &gt;{STALE_AFTER_DAYS.delivered}d ({overdue.length})
								</button>
							{/if}
							{#if included.length}
								<button
									type="button"
									class="text-muted-foreground hover:bg-muted rounded-full border px-2.5 py-0.5 text-xs transition-colors"
									onclick={() => select([])}
								>
									Clear
								</button>
							{/if}
						</div>
					</div>

					<div class="overflow-hidden rounded-lg border">
						<button
							type="button"
							role="checkbox"
							aria-checked={allPicked ? 'true' : included.length ? 'mixed' : 'false'}
							class="bg-muted/50 text-muted-foreground flex w-full items-center gap-3 border-b px-3 py-2 text-left text-xs"
							onclick={() => select(allPicked ? [] : rows)}
						>
							{@render box(allPicked ? 'on' : included.length ? 'mixed' : 'off')}
							<span class="flex-1">Tracking</span>
							<span class="w-24 text-right">Delivered</span>
						</button>
						<ul class="max-h-72 divide-y overflow-y-auto">
							{#each rows as t, i (t.id)}
								{@const on = picked.has(t.id)}
								{@const stale = isStale(t, now, tz)}
								<li>
									<button
										type="button"
										role="checkbox"
										aria-checked={on}
										class={cn(
											'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors select-none',
											on ? 'bg-primary/5' : 'hover:bg-muted/50'
										)}
										onclick={(e) => pick(i, e.shiftKey)}
									>
										{@render box(on ? 'on' : 'off')}
										<span class="min-w-0 flex-1">
											<span class="flex items-center gap-1.5 font-mono text-sm">
												<Flag code={t.destination} />
												<span class="truncate">{trackingLabel(t)}</span>
											</span>
											{#if t.notes}
												<span class="text-muted-foreground block truncate text-xs">{t.notes}</span>
											{/if}
										</span>
										<span class="w-24 shrink-0 text-right text-xs tabular-nums">
											<span class="text-muted-foreground block">{formatDate(deliveredAt(t))}</span>
											<span class={cn(stale ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
												{#if stale}<TriangleAlertIcon class="mr-0.5 inline size-3" />{/if}{ageLabel(t)}
											</span>
										</span>
									</button>
								</li>
							{/each}
						</ul>
					</div>
					<p class="text-muted-foreground hidden text-xs sm:block">Tip: shift-click to select a range.</p>
				</section>

				<!-- Preview -->
				<section class="grid gap-2">
					<h3 class="text-sm font-medium">Message</h3>
					{#if message}
						<pre
							class="bg-muted/50 max-h-56 overflow-y-auto rounded-lg border p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">{message}</pre>
					{:else}
						<p class="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-xs">
							Select parcels above to build the message.
						</p>
					{/if}
				</section>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>Close</Button>
				<Button type="button" onclick={copyMessage} disabled={!included.length}>
					{#if copied}
						<CheckIcon /> Copied
					{:else}
						<CopyIcon /> Copy message{#if included.length}&nbsp;<span class="tabular-nums">({included.length})</span>{/if}
					{/if}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>

{#snippet box(state: 'on' | 'off' | 'mixed')}
	<span
		aria-hidden="true"
		class={cn(
			'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
			state === 'off' ? 'border-input bg-background' : 'border-primary bg-primary text-primary-foreground'
		)}
	>
		{#if state === 'on'}<CheckIcon class="size-3" strokeWidth={3} />{:else if state === 'mixed'}<MinusIcon
				class="size-3"
				strokeWidth={3}
			/>{/if}
	</span>
{/snippet}
