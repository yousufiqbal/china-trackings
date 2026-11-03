<script lang="ts">
	import { COURIER_STATUS_LABEL, type CourierStatus } from '$lib/trackings';
	import { cn } from '$lib/utils';
	import TruckIcon from '@lucide/svelte/icons/truck';

	let { status, class: className }: { status: CourierStatus; class?: string } = $props();

	const tone: Record<CourierStatus, string> = {
		NotFound: 'bg-muted text-muted-foreground',
		InfoReceived: 'bg-muted text-muted-foreground',
		InTransit: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
		OutForDelivery: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
		AvailableForPickup: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
		Delivered: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
		DeliveryFailure: 'bg-red-500/10 text-red-700 dark:text-red-300',
		Exception: 'bg-red-500/10 text-red-700 dark:text-red-300',
		Expired: 'bg-red-500/10 text-red-700 dark:text-red-300'
	};
</script>

<span
	class={cn(
		'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-sans text-[11px] font-medium whitespace-nowrap',
		tone[status],
		className
	)}
	title="Courier status (17TRACK)"
>
	<TruckIcon class="size-3" />
	{COURIER_STATUS_LABEL[status]}
</span>
