// Tiny global lightbox state. Mount <Lightbox /> once in the layout, then call
// openLightbox(src) from anywhere.

let src = $state<string | null>(null);

export const lightbox = {
	get src() {
		return src;
	},
	open(url: string) {
		src = url;
	},
	close() {
		src = null;
	}
};

export const openLightbox = (url: string) => lightbox.open(url);
