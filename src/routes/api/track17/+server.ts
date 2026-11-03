import { json, type RequestHandler } from '@sveltejs/kit';
import { verifySignature, type TrackInfo } from '$lib/server/track17';
import { saveCourierInfo } from '$lib/server/courier';

/**
 * 17TRACK webhook. Set https://<your-domain>/api/track17 as the webhook URL in
 * the 17TRACK dashboard. Public route (no session), authenticated by signature.
 */
export const POST: RequestHandler = async ({ request }) => {
	const raw = await request.text();
	if (!verifySignature(raw, request.headers.get('sign'))) {
		return json({ error: 'Bad signature' }, { status: 401 });
	}
	let payload: { event?: string; data?: { number?: string; track_info?: TrackInfo } };
	try {
		payload = JSON.parse(raw);
	} catch {
		return json({ error: 'Bad JSON' }, { status: 400 });
	}
	if (payload.event === 'TRACKING_UPDATED' && payload.data?.number) {
		await saveCourierInfo(payload.data.number, payload.data.track_info);
	}
	return json({ ok: true });
};
