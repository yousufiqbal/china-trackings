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
import { handleAdvance, handleComment } from '$lib/server/advance';
import { isStatus, parseDateInput, type Status } from '$lib/trackings';

export const load: PageServerLoad = async ({ url }) => {
	const s = url.searchParams.get('status');
	const status: Status = isStatus(s) ? s : 'ordered';
	const q = url.searchParams.get('q') ?? '';

	const [trackings, counts] = await Promise.all([listTrackings({ status, q }), countByStatus()]);
	return { trackings, counts, filter: { status, q }, now: Date.now() };
};

function idFrom(form: FormData): number | null {
	const id = Number(form.get('id'));
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await request.formData();
		const raw = String(form.get('numbers') ?? '');
		const comment = String(form.get('comment') ?? '').trim().slice(0, 2000);

		const numbers = raw.split(/[\s,;]+/).filter(Boolean);
		if (!numbers.length) return fail(400, { action: 'add', error: 'Paste at least one tracking number' });

		const ordered_at = parseDateInput(form.get('ordered_at'));
		const result = await addTrackings(numbers, { notes: comment, ordered_at });
		return { action: 'add', ...result };
	},

	/** Advance to the next status on the happy path (ordered -> warehoused -> delivered). */
	advance: async ({ request }) => handleAdvance(await request.formData()),
	comment: async ({ request }) => handleComment(await request.formData()),

	lost: async ({ request }) => {
		const form = await request.formData();
		const id = idFrom(form);
		if (!id) return fail(400, { action: 'lost', error: 'Bad id' });
		const t = await setStatus(id, 'lost', { note: String(form.get('note') ?? '').trim() || null });
		if (!t) return fail(404, { action: 'lost', error: 'Not found' });
		return { action: 'lost', tracking_no: t.tracking_no };
	},

	/** Bring a lost/delivered parcel back to the active list. */
	reopen: async ({ request }) => {
		const form = await request.formData();
		const id = idFrom(form);
		if (!id) return fail(400, { action: 'reopen', error: 'Bad id' });
		const current = await getTracking(id);
		if (!current) return fail(404, { action: 'reopen', error: 'Not found' });
		// Delivered goes back one step; lost goes back to wherever it was before.
		const to: Status =
			current.status === 'delivered' || current.warehoused_at ? 'warehoused' : 'ordered';
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
