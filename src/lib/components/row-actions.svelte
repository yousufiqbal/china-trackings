<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { NEXT_STATUS, STATUS_LABEL, type Tracking } from '$lib/trackings';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import PencilIcon from '@lucide/svelte/icons/pencil';

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

	let next = $derived(NEXT_STATUS[tracking.status]);
	// An order without a tracking number cannot leave Ordered: button shown but disabled.
	let locked = $derived(!tracking.tracking_no);
</script>

<div class="flex items-center justify-end gap-1">
	{#if showPrimary && next}
		<Button
			size="sm"
			variant="outline"
			disabled={locked}
			title={locked ? 'Add the tracking number first' : undefined}
			onclick={() => onAdvance(tracking)}
		>
			{STATUS_LABEL[next]}
			<ArrowRightIcon />
		</Button>
	{/if}
	<Button size="icon-sm" variant="outline" onclick={() => onEdit(tracking)} aria-label="Edit" title="Edit">
		<PencilIcon />
	</Button>
</div>
