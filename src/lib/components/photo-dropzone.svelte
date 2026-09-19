<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { resizeImage } from '$lib/resize-image';
	import { cn } from '$lib/utils';
	import { openLightbox } from '$lib/lightbox.svelte';
	import ImageIcon from '@lucide/svelte/icons/image';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import CameraIcon from '@lucide/svelte/icons/camera';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';

	let {
		photoId,
		willWarehouse = false
	}: { photoId: number | null; /** true when uploading will also flip status to warehoused */ willWarehouse?: boolean } =
		$props();

	let dragging = $state(false);
	let uploading = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let cameraInput = $state<HTMLInputElement | null>(null);

	async function upload(file: File | null | undefined) {
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			toast.error('Only images are accepted');
			return;
		}
		uploading = true;
		try {
			const body = new FormData();
			body.set('photo', await resizeImage(file));
			const res = await fetch('?/photo', {
				method: 'POST',
				body,
				headers: { 'x-sveltekit-action': 'true' }
			});
			const result = deserialize(await res.text());
			if (result.type === 'success') {
				toast.success(willWarehouse ? 'Receipt saved, marked warehoused' : 'Receipt saved');
				await invalidateAll();
			} else if (result.type === 'failure') {
				toast.error(String(result.data?.error ?? 'Upload failed'));
			} else {
				toast.error('Upload failed');
			}
		} finally {
			uploading = false;
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		upload(e.dataTransfer?.files?.[0]);
	}

	function onPaste(e: ClipboardEvent) {
		const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
		if (item) upload(item.getAsFile());
	}
</script>

<svelte:window onpaste={onPaste} />

<input
	bind:this={fileInput}
	type="file"
	accept="image/*"
	class="hidden"
	onchange={(e) => {
		upload(e.currentTarget.files?.[0]);
		e.currentTarget.value = '';
	}}
/>
<input
	bind:this={cameraInput}
	type="file"
	accept="image/*"
	capture="environment"
	class="hidden"
	onchange={(e) => {
		upload(e.currentTarget.files?.[0]);
		e.currentTarget.value = '';
	}}
/>

<div
	role="button"
	tabindex="0"
	aria-label="Upload receipt photo"
	class={cn(
		'relative rounded-lg border-2 border-dashed transition-colors outline-none',
		dragging ? 'border-primary bg-primary/5' : 'border-border',
		!photoId && 'hover:border-primary/50 hover:bg-muted/40 cursor-pointer',
		'focus-visible:ring-ring/50 focus-visible:ring-3'
	)}
	ondragenter={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={(e) => {
		// only clear when leaving the zone itself, not a child
		if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) dragging = false;
	}}
	ondrop={onDrop}
	onclick={() => {
		if (!photoId) fileInput?.click();
	}}
	onkeydown={(e) => {
		if (!photoId && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			fileInput?.click();
		}
	}}
>
	{#if photoId}
		<button
			type="button"
			class="block w-full cursor-zoom-in p-2"
			aria-label="View receipt photo full size"
			onclick={(e) => {
				e.stopPropagation();
				openLightbox(`/photos/${photoId}`);
			}}
		>
			<img
				src="/photos/{photoId}"
				alt="Warehouse receipt"
				class="bg-muted/30 max-h-[420px] w-full rounded-md object-contain"
			/>
		</button>
	{:else}
		<div class="text-muted-foreground flex flex-col items-center gap-2 px-4 py-10 text-center text-sm">
			<ImageIcon class="size-6" />
			<span class="font-medium">Drop receipt photo here</span>
			<span class="text-xs">or click to choose, or paste from clipboard</span>
			{#if willWarehouse}
				<span class="mt-1 text-xs text-amber-700 dark:text-amber-300">Adding a photo marks this parcel as warehoused</span>
			{/if}
		</div>
	{/if}

	{#if dragging || uploading}
		<div
			class="bg-background/85 text-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg text-sm font-medium backdrop-blur-[1px]"
		>
			{#if uploading}
				<Loader2Icon class="size-5 animate-spin" /> Uploading…
			{:else}
				<UploadIcon class="size-5" /> {photoId ? 'Drop to replace' : 'Drop to upload'}
			{/if}
		</div>
	{/if}
</div>

<div class="mt-2 flex flex-wrap items-center gap-2">
	<Button variant="outline" size="sm" onclick={() => fileInput?.click()} disabled={uploading}>
		<UploadIcon /> {photoId ? 'Replace' : 'Choose file'}
	</Button>
	<Button variant="outline" size="sm" class="sm:hidden" onclick={() => cameraInput?.click()} disabled={uploading}>
		<CameraIcon /> Camera
	</Button>
	{#if photoId}
		<span class="text-muted-foreground text-xs">Tap image to zoom. Drop a new file to replace.</span>
	{/if}
</div>
