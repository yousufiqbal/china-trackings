import { fail } from '@sveltejs/kit';
import { getTracking, setStatus, updateTracking } from './trackings';
import { deletePhoto, savePhoto } from './photos';
import { isDestination, NEXT_STATUS, parseDateInput } from '$lib/trackings';

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

	try {
		await setStatus(id, to, {
			receipt_ref: to === 'warehoused' ? receipt_ref : undefined,
			receipt_photo_id: photoId ?? undefined,
			at: parseDateInput(form.get('at')) ?? undefined
		});
	} catch (e) {
		await deletePhoto(photoId);
		return fail(400, { action: 'advance', error: (e as Error).message });
	}
	if (photoId && t.receipt_photo_id) await deletePhoto(t.receipt_photo_id);
	return { action: 'advance' as const, to, tracking_no: t.tracking_no };
}

/**
 * Attach a receipt photo to a tracking. A receipt means the warehouse has
 * acknowledged the parcel, so anything before "warehoused" is moved there.
 * Returns the new photo id, or throws with a user-facing message.
 */
export async function attachPhoto(id: number, file: File | null | undefined): Promise<number | null> {
	const t = await getTracking(id);
	if (!t) throw new Error('Not found');
	if (!t.tracking_no) throw new Error('Add the tracking number before attaching a receipt');
	const photoId = await savePhoto(file);
	if (!photoId) return null;

	if (t.status === 'ordered' || t.status === 'delivered') {
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

/** Shared form-action body for the Edit dialog. */
export async function handleSave(id: number, form: FormData) {
	const current = await getTracking(id);
	if (!current) return fail(404, { error: 'Not found' });

	// undefined = leave photo alone, null = remove it, number = replace it
	let receipt_photo_id: number | null | undefined;
	try {
		receipt_photo_id = (await savePhoto(form.get('photo') as File | null)) ?? undefined;
	} catch (e) {
		return fail(400, { error: (e as Error).message });
	}
	if (receipt_photo_id === undefined && form.get('remove_photo') === 'on') receipt_photo_id = null;

	const dest = form.get('destination');
	const err = await updateTracking(id, {
		tracking_no: String(form.get('tracking_no') ?? '').trim() || null,
		destination: isDestination(dest) ? dest : undefined,
		receipt_ref: String(form.get('receipt_ref') ?? '').trim() || null,
		notes: String(form.get('notes') ?? '').trim() || null,
		receipt_photo_id,
		ordered_at: dateFrom(form.get('ordered_at'), current.ordered_at) ?? undefined,
		delivered_at: dateFrom(form.get('delivered_at'), current.delivered_at),
		warehoused_at: dateFrom(form.get('warehoused_at'), current.warehoused_at),
		received_at: dateFrom(form.get('received_at'), current.received_at)
	});
	if (err) {
		await deletePhoto(receipt_photo_id);
		return fail(400, { error: err });
	}
	// Old photo is unreferenced now that the update succeeded.
	if (receipt_photo_id !== undefined) await deletePhoto(current.receipt_photo_id);
	// A receipt photo means the warehouse acknowledged it.
	if (receipt_photo_id && (current.status === 'ordered' || current.status === 'delivered')) {
		try {
			await setStatus(id, 'warehoused', { note: 'Receipt photo added' });
		} catch {
			// no tracking number yet: keep the photo, stay in Ordered
		}
	}
	return { saved: true };
}
