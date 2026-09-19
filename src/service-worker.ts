/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Network-only service worker. It exists so the app is installable
// (standalone, no browser chrome) but it never serves cached content:
// every request goes straight to the network, so nothing is ever stale.

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', () => {
	sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Remove any caches left by earlier versions.
			for (const key of await caches.keys()) await caches.delete(key);
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	event.respondWith(fetch(event.request));
});
