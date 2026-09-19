import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	deleteTracking,
	getEvents,
	getTracking,
	setStatus,
	updateTracking
} from '$lib/server/trackings';
import { deletePhoto, savePhoto } from '$lib/server/photos';
import { attachPhoto, handleAdvance, handleComment } from '$lib/server/advance';
import { isStatus } from '$lib/trackings';

function parseId(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Not found');
	return id;
}

/** <input type="date"> gives YYYY-MM-DD; keep the original time-of-day if the day is unchanged. */
function dateFrom(value: FormDataEntryValue | null, previous: number | null): number | null | undefined {
	if (value === null) return undefined;
	const s = String(value).trim();
	if (!s) return null;
	const [y, m, d] = s.split('-').map(Number);
	if (!y || !m || !d) return undefined;
	const prev = previous ? new Date(previous) : null;
	if (prev && prev.getFullYear() === y && prev.getMonth() === m - 1 && prev.getDate() === d) {
		return previous;
	}
	return new Date(y, m - 1, d, 12).getTime();
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

	save: async ({ params, request }) => {
		const id = parseId(params.id);
		const current = await getTracking(id);
		if (!current) error(404);
		const form = await request.formData();

		// undefined = leave photo alone, null = remove it, number = replace it
		let receipt_photo_id: number | null | undefined;
		try {
			receipt_photo_id = (await savePhoto(form.get('photo') as File | null)) ?? undefined;
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
		if (receipt_photo_id === undefined && form.get('remove_photo') === 'on') receipt_photo_id = null;

		const err = await updateTracking(id, {
			tracking_no: String(form.get('tracking_no') ?? ''),
			receipt_ref: String(form.get('receipt_ref') ?? '').trim() || null,
			notes: String(form.get('notes') ?? '').trim() || null,
			receipt_photo_id,
			ordered_at: dateFrom(form.get('ordered_at'), current.ordered_at) ?? undefined,
			warehoused_at: dateFrom(form.get('warehoused_at'), current.warehoused_at),
			delivered_at: dateFrom(form.get('delivered_at'), current.delivered_at)
		});
		if (err) {
			await deletePhoto(receipt_photo_id);
			return fail(400, { error: err });
		}
		// Old photo is unreferenced now that the update succeeded.
		if (receipt_photo_id !== undefined) await deletePhoto(current.receipt_photo_id);
		// A receipt photo means the warehouse has it.
		if (receipt_photo_id && current.status === 'ordered') {
			await setStatus(id, 'warehoused', { note: 'Receipt photo added' });
		}
		return { saved: true };
	},

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
