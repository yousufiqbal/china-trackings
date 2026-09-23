<script lang="ts">
	import { destinationFlag, destinationLabel } from '$lib/trackings';
	import { cn } from '$lib/utils';

	// Emoji flags do not render on Windows, so use the SVG files in /static/flags.
	let {
		code,
		class: className,
		size = 'sm'
	}: { code: string | null | undefined; class?: string; size?: 'sm' | 'md' | 'lg' } = $props();

	const sizes = { sm: 'h-3 w-[18px]', md: 'h-3.5 w-[21px]', lg: 'h-4 w-6' };
	let src = $derived(destinationFlag(code));
	let label = $derived(destinationLabel(code));
</script>

{#if src}
	<img
		{src}
		alt={label}
		title={label}
		loading="lazy"
		class={cn('shrink-0 rounded-[2px] object-cover ring-1 ring-black/10', sizes[size], className)}
	/>
{/if}
