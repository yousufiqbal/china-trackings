<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { formatDate, trackingLabel, type Tracking } from '$lib/trackings';
	import { cn } from '$lib/utils';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckIcon from '@lucide/svelte/icons/check';

	let {
		open = $bindable(false),
		trackings
	}: {
		open?: boolean;
		/** Delivered parcels (at warehouse, receipt pending). */
		trackings: Tracking[];
	} = $props();

	let mode = $state<'all' | 'some'>('all');
	let picked = $state<Set<number>>(new Set());
	let markAlerted = $state(true);
	let copied = $state(false);
	let busy = $state(false);

	const longDate = (ms: number) =>
		new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

	let included = $derived(mode === 'all' ? trackings : trackings.filter((t) => picked.has(t.id)));

	let message = $derived.by(() => {
		if (!included.length) return '';
		const lines = included.map((t) => {
			const label = t.tracking_no ?? `[no tracking] ${t.notes ?? ''}`.trim();
			return `${label} (Delivered on ${longDate(t.delivered_at ?? t.updated_at)})`;
		});
		return ['Dear forwarder,', '', 'Receipts are required for the following trackings:', ...lines, '', 'Thank you.'].join('\n');
	});

	function toggle(id: number) {
		const next = new Set(picked);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		picked = next;
	}

	async function copyMessage() {
		if (!message) return;
		busy = true;
		try {
			await navigator.clipboard.writeText(message);
			copied = true;
			toast.success('Message copied');
			setTimeout(() => (copied = false), 2000);

			if (markAlerted) {
				const body = new FormData();
				for (const t of included) body.append('ids', String(t.id));
				const res = await fetch('/?/alerted', {
					method: 'POST',
					body,
					headers: { 'x-sveltekit-action': 'true' }
				});
				const result = deserialize(await res.text());
				if (result.type === 'success') await invalidateAll();
				else toast.error('Could not mark as alerted');
			}
		} catch {
			toast.error('Could not copy');
		} finally {
			busy = false;
		}
	}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(v) => {
		if (v) {
			mode = 'all';
			picked = new Set();
			copied = false;
		}
	}}
>
	<Dialog.Content class="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Request receipts</Dialog.Title>
			<Dialog.Description>
				Message for your forwarder covering delivered parcels that still have no receipt.
			</Dialog.Description>
		</Dialog.Header>

		{#if !trackings.length}
			<p class="text-muted-foreground py-6 text-center text-sm">No delivered parcels waiting for a receipt.</p>
		{:else}
			<fieldset class="grid gap-2">
				<legend class="sr-only">Which trackings</legend>
				<label class="flex cursor-pointer items-center gap-2 text-sm">
					<input type="radio" name="mode" value="all" bind:group={mode} />
					All delivered <span class="text-muted-foreground tabular-nums">({trackings.length})</span>
				</label>
				<label class="flex cursor-pointer items-center gap-2 text-sm">
					<input type="radio" name="mode" value="some" bind:group={mode} />
					Only selected
				</label>
			</fieldset>

			{#if mode === 'some'}
				<ul class="grid max-h-56 gap-1 overflow-y-auto rounded-md border p-2">
					{#each trackings as t (t.id)}
						<li>
							<label
								class={cn(
									'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm',
									picked.has(t.id) ? 'bg-muted' : 'hover:bg-muted/50'
								)}
							>
								<input type="checkbox" checked={picked.has(t.id)} onchange={() => toggle(t.id)} />
								<span class="min-w-0 flex-1">
									<span class="font-mono">{trackingLabel(t)}</span>
									{#if t.notes}
										<span class="text-muted-foreground block truncate text-xs">{t.notes}</span>
									{/if}
								</span>
								<span class="text-muted-foreground shrink-0 text-xs tabular-nums">
									{formatDate(t.delivered_at ?? t.updated_at)}
								</span>
							</label>
						</li>
					{/each}
				</ul>
				<div class="flex gap-2 text-xs">
					<button type="button" class="text-muted-foreground hover:text-foreground underline" onclick={() => (picked = new Set(trackings.map((t) => t.id)))}>
						Select all
					</button>
					<button type="button" class="text-muted-foreground hover:text-foreground underline" onclick={() => (picked = new Set())}>
						Clear
					</button>
				</div>
			{/if}

			<Textarea readonly rows={Math.min(14, 6 + included.length)} value={message} class="font-mono text-xs" />

			<label class="flex cursor-pointer items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={markAlerted} />
				Add "Alerted" to the comment of included trackings
			</label>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>Close</Button>
				<Button type="button" onclick={copyMessage} disabled={!included.length || busy}>
					{#if copied}<CheckIcon /> Copied{:else}<CopyIcon /> Copy message{/if}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
