import { fail } from '@sveltejs/kit';
import { getTracking, setStatus, updateTracking } from './trackings';
import { deletePhoto, savePhoto } from './photos';
import { NEXT_STATUS, parseDateInput } from '$lib/trackings';

/**
 * Shared form-action body for "advance to next status". Used by the dashboard
 * and the detail page so the AdvanceDialog works from either.
 */
export async function handleAdvance(form: FormData) {
	const id = Number(form.get('id'));
	if (!Number.isInteger(id) || id <= 0) return fail(400, { action: 'advance', error: 'Bad id' });

	const t = await getTracking(id);
	if (!t) return fail(404, { action: 'advance', error: 'Not found' });
	const to = NEXT_STATUS[t.status];
	if (!to) return fail(400, { action: 'advance', error: `Nothing after "${t.status}"` });

	const receipt_ref = String(form.get('receipt_ref') ?? '').trim() || null;
	let photoId: number | null;
	try {
		photoId = await savePhoto(form.get('photo') as File | null);
	} catch (e) {
		return fail(400, { action: 'advance', error: (e as Error).message });
	}

	await setStatus(id, to, {
		receipt_ref: to === 'warehoused' ? receipt_ref : undefined,
		receipt_photo_id: photoId ?? undefined,
		at: parseDateInput(form.get('at')) ?? undefined
	});
	if (photoId && t.receipt_photo_id) await deletePhoto(t.receipt_photo_id);
	return { action: 'advance' as const, to, tracking_no: t.tracking_no };
}

/**
 * Attach a receipt photo to a tracking. A receipt means the warehouse has the
 * parcel, so an "ordered" tracking is moved to "warehoused" at the same time.
 * Returns the new photo id, or throws with a user-facing message.
 */
export async function attachPhoto(id: number, file: File | null | undefined): Promise<number | null> {
	const t = await getTracking(id);
	if (!t) throw new Error('Not found');
	const photoId = await savePhoto(file);
	if (!photoId) return null;

	if (t.status === 'ordered') {
		await setStatus(id, 'warehoused', { receipt_photo_id: photoId, note: 'Receipt photo added' });
	} else {
		await updateTracking(id, { receipt_photo_id: photoId });
	}
	if (t.receipt_photo_id) await deletePhoto(t.receipt_photo_id);
	return photoId;
}

/** Shared form-action body for saving the free-text comment (stored in `notes`). */
export async function handleComment(form: FormData) {
	const id = Number(form.get('id'));
	if (!Number.isInteger(id) || id <= 0) return fail(400, { action: 'comment', error: 'Bad id' });
	const t = await getTracking(id);
	if (!t) return fail(404, { action: 'comment', error: 'Not found' });
	const notes = String(form.get('comment') ?? '').trim().slice(0, 2000) || null;
	await updateTracking(id, { notes });
	return { action: 'comment' as const, tracking_no: t.tracking_no };
}
