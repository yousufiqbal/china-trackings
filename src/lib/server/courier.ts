import { query, run } from './db';
import { getTrackInfo, register, toCourierFields, track17Enabled, type TrackInfo } from './track17';

/** Save courier data for one tracking number. Does not touch updated_at (that tracks our own edits). */
export async function saveCourierInfo(number: string, info: TrackInfo | null | undefined) {
	const f = toCourierFields(info);
	await run(
		`UPDATE trackings SET courier = COALESCE(?, courier), courier_status = ?, courier_event = ?,
			courier_event_at = ?, courier_events = ?, courier_checked_at = ? WHERE tracking_no = ?`,
		[f.courier, f.courier_status, f.courier_event, f.courier_event_at, f.courier_events, Date.now(), number]
	);
}

/**
 * Register numbers with 17TRACK in the background of another action (add, fill
 * in number). Never throws: a courier hiccup must not block saving a parcel.
 */
export async function registerQuietly(numbers: (string | null | undefined)[]) {
	const list = numbers.filter((n): n is string => !!n);
	if (!track17Enabled() || !list.length) return;
	try {
		const rejected = await register(list);
		for (const r of rejected) console.warn(`17TRACK register ${r.number}: ${r.error?.message}`);
	} catch (e) {
		console.warn('17TRACK register failed:', (e as Error).message);
	}
}

/** Register (if needed) and fetch the latest courier data for these numbers. Throws on API failure. */
export async function refreshCourier(numbers: string[]) {
	if (!numbers.length) return { updated: 0, failed: [] as string[] };
	const rejectedReg = await register(numbers);
	const { accepted, rejected } = await getTrackInfo(numbers);
	for (const a of accepted) await saveCourierInfo(a.number, a.track_info);
	return {
		updated: accepted.length,
		failed: [...rejectedReg, ...rejected].map((r) => `${r.number}: ${r.error?.message ?? 'rejected'}`)
	};
}

/** Refresh every parcel still waiting to reach the warehouse. */
export async function syncOrdered() {
	const rows = await query<{ tracking_no: string }>(
		`SELECT tracking_no FROM trackings WHERE status = 'ordered' AND tracking_no IS NOT NULL`
	);
	return refreshCourier(rows.map((r) => r.tracking_no));
}
