<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from '$lib/components/ui/sonner';
	import Lightbox from '$lib/components/lightbox.svelte';
	import { Button } from '$lib/components/ui/button';
	import PackageIcon from '@lucide/svelte/icons/package';
	import LogOutIcon from '@lucide/svelte/icons/log-out';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Trackings</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<Toaster richColors position="top-center" />
<Lightbox />

<div class="bg-background text-foreground min-h-dvh">
	{#if data.user}
		<header class="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
			<div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
				<a href="/" class="flex items-center gap-2 font-semibold tracking-tight">
					<span class="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
						<PackageIcon class="size-4" />
					</span>
					<span>Trackings</span>
				</a>
				<form method="POST" action="/logout">
					<Button type="submit" variant="ghost" size="sm" class="text-muted-foreground">
						<LogOutIcon class="size-4" />
						<span class="hidden sm:inline">Log out</span>
					</Button>
				</form>
			</div>
		</header>
	{/if}

	<main class="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:py-8">
		{@render children()}
	</main>
</div>
