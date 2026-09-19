import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPhoto } from '$lib/server/photos';

// Receipt photos are served from the database, behind the login (see hooks.server.ts).
export const GET: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404);
	const photo = await getPhoto(id);
	if (!photo) error(404);
	return new Response(new Uint8Array(photo.data), {
		headers: {
			'Content-Type': photo.mime,
			'Content-Length': String(photo.size),
			'Cache-Control': 'private, max-age=31536000, immutable'
		}
	});
};
