import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteTracking, getEvents, getTracking, setStatus } from '$lib/server/trackings';
import { deletePhoto } from '$lib/server/photos';
import { attachPhoto, handleAdvance, handleComment, handleSave } from '$lib/server/advance';
import { isStatus } from '$lib/trackings';

function parseId(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Not found');
	return id;
}

export const load: PageServerLoad = async ({ params }) => {
	const id = parseId(params.id);
	const tracking = await getTracking(id);
	if (!tracking) error(404, 'Tracking not found');
	const events = await getEvents(id);
	return { tracking, events, now: Date.now() };
};

export const actions: Actions = {
	advance: async ({ request }) => handleAdvance(await request.formData()),
	comment: async ({ request }) => handleComment(await request.formData()),

	/** Drag-and-drop / quick upload of the receipt photo. Moves ordered -> warehoused. */
	photo: async ({ params, request }) => {
		const id = parseId(params.id);
		const form = await request.formData();
		try {
			const photoId = await attachPhoto(id, form.get('photo') as File | null);
			if (!photoId) return fail(400, { error: 'No photo received' });
			return { saved: true, photoId };
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
	},

	save: async ({ params, request }) => handleSave(parseId(params.id), await request.formData()),

	/** Manual status override (corrections). */
	status: async ({ params, request }) => {
		const id = parseId(params.id);
		const form = await request.formData();
		const to = form.get('status');
		if (!isStatus(to)) return fail(400, { error: 'Bad status' });
		const note = String(form.get('note') ?? '').trim() || null;
		const t = await setStatus(id, to, { note });
		if (!t) error(404);
		return { saved: true };
	},

	delete: async ({ params }) => {
		const id = parseId(params.id);
		const t = await getTracking(id);
		if (t) {
			await deleteTracking(id);
			await deletePhoto(t.receipt_photo_id);
		}
		redirect(303, '/');
	}
};
