import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	addTrackings,
	countByStatus,
	deleteTracking,
	getTracking,
	listTrackings,
	setStatus
} from '$lib/server/trackings';
import { deletePhoto } from '$lib/server/photos';
import { attachPhoto, handleAdvance, handleComment, handleSave } from '$lib/server/advance';
import { isStatus, normalizeTrackingNo, parseDateInput, type Status } from '$lib/trackings';

export const load: PageServerLoad = async ({ url }) => {
	const s = url.searchParams.get('status');
	const status: Status = isStatus(s) ? s : 'ordered';
	const q = url.searchParams.get('q') ?? '';

	// A search spans every status; otherwise show the selected status only.
	const [trackings, counts] = await Promise.all([
		listTrackings({ status: q ? 'all' : status, q }),
		countByStatus()
	]);
	return { trackings, counts, filter: { status, q }, now: Date.now() };
};

function idFrom(form: FormData): number | null {
	const id = Number(form.get('id'));
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await request.formData();
		const number = normalizeTrackingNo(String(form.get('number') ?? ''));
		const comment = String(form.get('comment') ?? '').trim().slice(0, 2000);
		if (!number) return fail(400, { action: 'add', error: 'Enter a tracking number' });
		if (/\s/.test(String(form.get('number')).trim())) {
			return fail(400, { action: 'add', error: 'One tracking number at a time' });
		}

		const ordered_at = parseDateInput(form.get('ordered_at'));
		const result = await addTrackings([number], { notes: comment, ordered_at });
		if (result.duplicates.length) return fail(409, { action: 'add', error: `${number} already exists` });
		if (result.invalid.length) return fail(400, { action: 'add', error: 'Tracking number must be 4-64 characters' });
		return { action: 'add', tracking_no: number };
	},

	/** Advance to the next status on the happy path (ordered -> delivered -> warehoused -> received). */
	advance: async ({ request }) => handleAdvance(await request.formData()),
	comment: async ({ request }) => handleComment(await request.formData()),

	/** Drag-and-drop / quick upload of the receipt photo. Moves ordered/delivered -> warehoused. */
	photo: async ({ request }) => {
		const form = await request.formData();
		const id = idFrom(form);
		if (!id) return fail(400, { error: 'Bad id' });
		try {
			const photoId = await attachPhoto(id, form.get('photo') as File | null);
			if (!photoId) return fail(400, { error: 'No photo received' });
			return { saved: true, photoId };
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
	},

	/** Manual status override (corrections). */
	status: async ({ request }) => {
		const form = await request.formData();
		const id = idFrom(form);
		if (!id) return fail(400, { error: 'Bad id' });
		const to = form.get('status');
		if (!isStatus(to)) return fail(400, { error: 'Bad status' });
		const note = String(form.get('note') ?? '').trim() || null;
		const t = await setStatus(id, to, { note });
		if (!t) return fail(404, { error: 'Not found' });
		return { saved: true };
	},
	save: async ({ request }) => {
		const form = await request.formData();
		const id = idFrom(form);
		if (!id) return fail(400, { error: 'Bad id' });
		return handleSave(id, form);
	},

	lost: async ({ request }) => {
		const form = await request.formData();
		const id = idFrom(form);
		if (!id) return fail(400, { action: 'lost', error: 'Bad id' });
		const t = await setStatus(id, 'lost', { note: String(form.get('note') ?? '').trim() || null });
		if (!t) return fail(404, { action: 'lost', error: 'Not found' });
		return { action: 'lost', tracking_no: t.tracking_no };
	},

	/** Bring a lost/received parcel back to the active list, at the furthest step it had reached. */
	reopen: async ({ request }) => {
		const form = await request.formData();
		const id = idFrom(form);
		if (!id) return fail(400, { action: 'reopen', error: 'Bad id' });
		const current = await getTracking(id);
		if (!current) return fail(404, { action: 'reopen', error: 'Not found' });
		const to: Status =
			current.status === 'received' || current.warehoused_at
				? 'warehoused'
				: current.delivered_at
					? 'delivered'
					: 'ordered';
		const t = await setStatus(id, to, { note: 'Reopened' });
		return { action: 'reopen', tracking_no: t?.tracking_no };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = idFrom(form);
		if (!id) return fail(400, { action: 'delete', error: 'Bad id' });
		const t = await getTracking(id);
		if (!t) return fail(404, { action: 'delete', error: 'Not found' });
		await deleteTracking(id);
		await deletePhoto(t.receipt_photo_id);
		return { action: 'delete', tracking_no: t.tracking_no };
	}
};
