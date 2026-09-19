<script lang="ts">
	import './layout.css';
	import { Toaster } from '$lib/components/ui/sonner';
	import Lightbox from '$lib/components/lightbox.svelte';
	import { invalidateAll } from '$app/navigation';
	import { navigating } from '$app/state';

	let { children } = $props();
</script>

<!-- Installed PWAs keep the page alive in the background; refetch when it comes back. -->
<svelte:document
	onvisibilitychange={() => {
		if (document.visibilityState === 'visible') invalidateAll();
	}}
/>
<svelte:window onpageshow={(e) => e.persisted && invalidateAll()} />

<svelte:head>
	<link rel="icon" href="/icon.svg" type="image/svg+xml" />
	<title>Trackings</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content="Trackings" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</svelte:head>

{#if navigating.to}
	<!-- Top loading bar: fades in after a short delay so quick hops don't flash it -->
	<div class="pointer-events-none fixed inset-x-0 top-0 z-[90] h-0.5 overflow-hidden" role="progressbar" aria-label="Loading">
		<div class="bg-primary loading-bar h-full w-1/3 rounded-full"></div>
	</div>
{/if}

<Toaster richColors position="top-center" />
<Lightbox />

<div class="bg-background text-foreground min-h-dvh">

	<main class="mx-auto w-full min-w-0 max-w-6xl px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:py-8">
		{@render children()}
	</main>
</div>

<style>
	.loading-bar {
		opacity: 0;
		animation:
			loading-slide 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite,
			loading-fade 0.2s 0.15s forwards;
	}
	@keyframes loading-slide {
		0% {
			transform: translateX(-100%);
		}
		60% {
			transform: translateX(200%);
		}
		100% {
			transform: translateX(300%);
		}
	}
	@keyframes loading-fade {
		to {
			opacity: 1;
		}
	}
</style>
