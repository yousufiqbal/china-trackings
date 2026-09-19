<script lang="ts">
	// Drag & drop / click / paste / camera picker that stages ONE image file.
	// It does not upload; the parent puts `file` into its form submission.
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import ImageIcon from '@lucide/svelte/icons/image';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import CameraIcon from '@lucide/svelte/icons/camera';
	import XIcon from '@lucide/svelte/icons/x';

	let {
		file = $bindable(null),
		label = 'Drop receipt photo here'
	}: { file: File | null; label?: string } = $props();

	let dragging = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let cameraInput = $state<HTMLInputElement | null>(null);
	let preview = $state<string | null>(null);

	function pick(f: File | null | undefined) {
		if (!f) return;
		if (!f.type.startsWith('image/')) return;
		if (preview) URL.revokeObjectURL(preview);
		file = f;
		preview = URL.createObjectURL(f);
	}

	function clear() {
		if (preview) URL.revokeObjectURL(preview);
		preview = null;
		file = null;
	}

	function onPaste(e: ClipboardEvent) {
		const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
		if (item) pick(item.getAsFile());
	}
</script>

<svelte:window onpaste={onPaste} />

<input
	bind:this={fileInput}
	type="file"
	accept="image/*"
	class="hidden"
	onchange={(e) => {
		pick(e.currentTarget.files?.[0]);
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
		pick(e.currentTarget.files?.[0]);
		e.currentTarget.value = '';
	}}
/>

<div
	role="button"
	tabindex="0"
	aria-label={label}
	class={cn(
		'relative cursor-pointer rounded-lg border-2 border-dashed transition-colors outline-none',
		'focus-visible:ring-ring/50 focus-visible:ring-3',
		dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40'
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
		if (!e.currentTarget.contains(e.relatedTarget as Node)) dragging = false;
	}}
	ondrop={(e) => {
		e.preventDefault();
		dragging = false;
		pick(e.dataTransfer?.files?.[0]);
	}}
	onclick={() => fileInput?.click()}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			fileInput?.click();
		}
	}}
>
	{#if preview}
		<div class="flex items-center gap-3 p-2">
			<img src={preview} alt="Selected receipt" class="size-20 shrink-0 rounded-md border object-cover" />
			<div class="min-w-0 flex-1 text-sm">
				<div class="truncate font-medium">{file?.name}</div>
				<div class="text-muted-foreground text-xs">Drop or click to replace</div>
			</div>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				aria-label="Remove photo"
				onclick={(e) => {
					e.stopPropagation();
					clear();
				}}
			>
				<XIcon />
			</Button>
		</div>
	{:else}
		<div class="text-muted-foreground flex flex-col items-center gap-1.5 px-4 py-6 text-center text-sm">
			<ImageIcon class="size-5" />
			<span class="font-medium">{label}</span>
			<span class="text-xs">or click to choose, or paste</span>
		</div>
	{/if}

	{#if dragging}
		<div class="bg-background/85 text-foreground absolute inset-0 flex items-center justify-center gap-2 rounded-lg text-sm font-medium">
			<UploadIcon class="size-5" /> Drop it
		</div>
	{/if}
</div>

<div class="flex items-center gap-2 sm:hidden">
	<Button type="button" variant="outline" size="sm" onclick={() => cameraInput?.click()}>
		<CameraIcon /> Take photo
	</Button>
</div>
