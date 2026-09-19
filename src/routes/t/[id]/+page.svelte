<script lang="ts">
	import { goto } from '$app/navigation';
	import DetailDialog from '$lib/components/detail-dialog.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.tracking.tracking_no} · Trackings</title></svelte:head>

<!-- Deep link: the dashboard is rendered underneath via the layout; the detail opens as the same modal. -->
<div class="text-muted-foreground py-16 text-center text-sm">
	<a href="/" class="hover:text-foreground underline underline-offset-4">Back to all trackings</a>
</div>

<DetailDialog
	tracking={data.tracking}
	now={data.now}
	open={true}
	showOpenLink={false}
	onClose={() => goto('/')}
/>
