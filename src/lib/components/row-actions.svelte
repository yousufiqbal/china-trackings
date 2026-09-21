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

	// An order without a tracking number cannot leave Ordered.
	let next = $derived(tracking.tracking_no ? NEXT_STATUS[tracking.status] : undefined);
</script>

<div class="flex items-center justify-end gap-1">
	{#if showPrimary && next}
		<Button size="sm" variant="outline" onclick={() => onAdvance(tracking)}>
			{STATUS_LABEL[next]}
			<ArrowRightIcon />
		</Button>
	{/if}
	<Button size="icon-sm" variant="outline" onclick={() => onEdit(tracking)} aria-label="Edit" title="Edit">
		<PencilIcon />
	</Button>
</div>
