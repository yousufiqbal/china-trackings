<script lang="ts">
	import { lightbox } from '$lib/lightbox.svelte';
	import XIcon from '@lucide/svelte/icons/x';
	import ZoomInIcon from '@lucide/svelte/icons/zoom-in';
	import ZoomOutIcon from '@lucide/svelte/icons/zoom-out';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

	const MIN = 1;
	const MAX = 6;

	let scale = $state(1);
	let tx = $state(0);
	let ty = $state(0);
	let animate = $state(false);

	// Active pointers for pan / pinch. Map keeps insertion order.
	const pointers = new Map<number, { x: number; y: number }>();
	let pinchStart: { dist: number; scale: number; cx: number; cy: number; tx: number; ty: number } | null = null;
	let panStart: { x: number; y: number; tx: number; ty: number } | null = null;
	let lastTap = 0;
	let container = $state<HTMLDivElement | null>(null);

	function reset() {
		scale = 1;
		tx = 0;
		ty = 0;
	}

	function close() {
		lightbox.close();
		reset();
		pointers.clear();
		pinchStart = null;
		panStart = null;
	}

	function clamp() {
		scale = Math.min(MAX, Math.max(MIN, scale));
		if (scale === 1) {
			tx = 0;
			ty = 0;
		}
	}

	/** Zoom around a point (in viewport coords) keeping that point fixed on screen. */
	function zoomAt(factor: number, cx: number, cy: number) {
		const rect = container?.getBoundingClientRect();
		if (!rect) return;
		const ox = cx - rect.left - rect.width / 2;
		const oy = cy - rect.top - rect.height / 2;
		const next = Math.min(MAX, Math.max(MIN, scale * factor));
		const k = next / scale;
		tx = ox - (ox - tx) * k;
		ty = oy - (oy - ty) * k;
		scale = next;
		clamp();
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		animate = false;
		zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
	}

	function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	function onPointerDown(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		animate = false;

		if (pointers.size === 2) {
			const [a, b] = [...pointers.values()];
			pinchStart = { dist: dist(a, b), scale, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, tx, ty };
			panStart = null;
		} else if (pointers.size === 1) {
			panStart = { x: e.clientX, y: e.clientY, tx, ty };
			// double tap / double click toggles zoom
			const now = Date.now();
			if (now - lastTap < 300) {
				animate = true;
				if (scale > 1) reset();
				else zoomAt(2.5, e.clientX, e.clientY);
				lastTap = 0;
			} else {
				lastTap = now;
			}
		}
	}

	function onPointerMove(e: PointerEvent) {
		if (!pointers.has(e.pointerId)) return;
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

		if (pointers.size >= 2 && pinchStart) {
			const [a, b] = [...pointers.values()];
			const d = dist(a, b);
			const next = Math.min(MAX, Math.max(MIN, (pinchStart.scale * d) / pinchStart.dist));
			const rect = container!.getBoundingClientRect();
			const ox = pinchStart.cx - rect.left - rect.width / 2;
			const oy = pinchStart.cy - rect.top - rect.height / 2;
			const k = next / pinchStart.scale;
			const mx = (a.x + b.x) / 2 - pinchStart.cx;
			const my = (a.y + b.y) / 2 - pinchStart.cy;
			tx = ox - (ox - pinchStart.tx) * k + mx;
			ty = oy - (oy - pinchStart.ty) * k + my;
			scale = next;
		} else if (pointers.size === 1 && panStart && scale > 1) {
			tx = panStart.tx + (e.clientX - panStart.x);
			ty = panStart.ty + (e.clientY - panStart.y);
		}
	}

	function onPointerUp(e: PointerEvent) {
		pointers.delete(e.pointerId);
		if (pointers.size < 2) pinchStart = null;
		if (pointers.size === 1) {
			const [p] = [...pointers.values()];
			panStart = { x: p.x, y: p.y, tx, ty };
		} else {
			panStart = null;
		}
		if (pointers.size === 0) {
			animate = true;
			clamp();
		}
	}

	// Lock page scroll while open (external DOM side effect, hence an effect).
	$effect(() => {
		document.body.style.overflow = lightbox.src ? 'hidden' : '';
		return () => {
			document.body.style.overflow = '';
		};
	});

	function onKey(e: KeyboardEvent) {
		if (!lightbox.src) return;
		if (e.key === 'Escape') close();
		if (e.key === '+' || e.key === '=') zoomAt(1.25, innerWidth / 2, innerHeight / 2);
		if (e.key === '-') zoomAt(1 / 1.25, innerWidth / 2, innerHeight / 2);
	}
</script>

<svelte:window onkeydown={onKey} />

{#if lightbox.src}
	<div
		class="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white select-none"
		role="dialog"
		aria-modal="true"
		aria-label="Photo"
	>
		<!-- Toolbar -->
		<div class="flex items-center justify-end gap-1 p-2 sm:p-3">
			<button
				class="rounded-full p-2 hover:bg-white/10"
				onclick={() => zoomAt(1 / 1.25, innerWidth / 2, innerHeight / 2)}
				aria-label="Zoom out"
			>
				<ZoomOutIcon class="size-5" />
			</button>
			<span class="w-12 text-center text-xs tabular-nums opacity-70">{Math.round(scale * 100)}%</span>
			<button
				class="rounded-full p-2 hover:bg-white/10"
				onclick={() => zoomAt(1.25, innerWidth / 2, innerHeight / 2)}
				aria-label="Zoom in"
			>
				<ZoomInIcon class="size-5" />
			</button>
			<a
				href={lightbox.src}
				target="_blank"
				class="rounded-full p-2 hover:bg-white/10"
				aria-label="Open original"
			>
				<ExternalLinkIcon class="size-5" />
			</a>
			<button class="ml-1 rounded-full p-2 hover:bg-white/10" onclick={close} aria-label="Close">
				<XIcon class="size-6" />
			</button>
		</div>

		<!-- Stage -->
		<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
		<div
			bind:this={container}
			role="presentation"
			class="flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden px-2 pb-2"
			style="cursor: {scale > 1 ? 'grab' : 'zoom-in'}"
			onwheel={onWheel}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			onclick={(e) => {
				// click on the empty backdrop closes; clicks on the image are handled by pointer events
				if (e.target === e.currentTarget && scale === 1) close();
			}}
		>
			<img
				src={lightbox.src}
				alt="Receipt"
				draggable="false"
				class="max-h-full max-w-full object-contain will-change-transform"
				class:transition-transform={animate}
				class:duration-200={animate}
				style="transform: translate({tx}px, {ty}px) scale({scale})"
			/>
		</div>

		<p class="pb-3 text-center text-[11px] opacity-60">Pinch or scroll to zoom · double-tap to toggle · Esc to close</p>
	</div>
{/if}
