<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { STATUS_LABEL, type Status } from '$lib/trackings';
	import { cn } from '$lib/utils';

	let { status, class: className }: { status: Status; class?: string } = $props();

	const styles: Record<Status, string> = {
		ordered: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
		warehoused: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
		delivered: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
		lost: 'bg-red-500/10 text-red-700 dark:text-red-300'
	};
</script>

<Badge variant="secondary" class={cn(styles[status], className)}>
	<span
		class={cn('size-1.5 rounded-full', {
			'bg-blue-500': status === 'ordered',
			'bg-amber-500': status === 'warehoused',
			'bg-emerald-500': status === 'delivered',
			'bg-red-500': status === 'lost'
		})}
	></span>
	{STATUS_LABEL[status]}
</Badge>
