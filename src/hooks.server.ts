import { redirect, type Handle } from '@sveltejs/kit';
import { readSession } from '$lib/server/auth';
import { localTzOffset, parseTzOffset, TZ_COOKIE } from '$lib/trackings';

const PUBLIC_PATHS = ['/login'];

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = readSession(event.cookies);
	// Until the browser has set the cookie, fall back to the server's own timezone.
	event.locals.tz = parseTzOffset(event.cookies.get(TZ_COOKIE)) ?? localTzOffset();

	const path = event.url.pathname;
	const isPublic = PUBLIC_PATHS.includes(path);

	if (!event.locals.user && !isPublic) {
		redirect(303, `/login?next=${encodeURIComponent(path + event.url.search)}`);
	}
	if (event.locals.user && path === '/login') {
		redirect(303, '/');
	}

	const response = await resolve(event);
	// Pages and data must never be served stale (installed PWA relaunches, bfcache).
	if (!path.startsWith('/photos/') && !path.startsWith('/_app/')) {
		response.headers.set('Cache-Control', 'no-store');
	}
	return response;
};
