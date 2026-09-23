import { db, ensureSchema, query, queryMany, queryOne, run } from './db';
import {
	isStatus,
	type Destination,
	normalizeTrackingNo,
	type Status,
	type StatusEvent,
	type Tracking
} from '$lib/trackings';

export interface ListFilter {
	status?: Status | 'active' | 'all';
	q?: string;
}

function listSql(filter: ListFilter = {}): { sql: string; args: (string | number)[] } {
	const where: string[] = [];
	const args: (string | number)[] = [];

	if (filter.status === 'active' || !filter.status) {
		where.push(`status IN ('ordered','delivered','warehoused')`);
	} else if (filter.status !== 'all') {
		where.push('status = ?');
		args.push(filter.status);
	}

	if (filter.q) {
		const like = `%${filter.q.trim()}%`;
		where.push(
			`(tracking_no LIKE ? COLLATE NOCASE OR supplier LIKE ? COLLATE NOCASE OR description LIKE ? COLLATE NOCASE OR receipt_ref LIKE ? COLLATE NOCASE OR notes LIKE ? COLLATE NOCASE)`
		);
		args.push(like, like, like, like, like);
	}

	const sql = `SELECT * FROM trackings ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
		ORDER BY ordered_at DESC, id DESC`;
	return { sql, args };
}

export async function listTrackings(filter: ListFilter = {}): Promise<Tracking[]> {
	const { sql, args } = listSql(filter);
	return query<Tracking>(sql, args);
}

const COUNT_SQL = 'SELECT status, COUNT(*) AS n FROM trackings GROUP BY status';

function toCounts(rows: { status: Status; n: number }[]): Record<Status, number> {
	const out: Record<Status, number> = { ordered: 0, delivered: 0, warehoused: 0, received: 0, lost: 0 };
	for (const r of rows) out[r.status] = Number(r.n);
	return out;
}

/** Everything the dashboard needs, fetched in a single round trip. */
export async function dashboardData(filter: ListFilter) {
	const [list, countRows, delivered] = await queryMany<
		[Tracking[], { status: Status; n: number }[], Tracking[]]
	>([listSql(filter), { sql: COUNT_SQL }, listSql({ status: 'delivered' })]);
	return { trackings: list, counts: toCounts(countRows), delivered };
}

export async function countByStatus(): Promise<Record<Status, number>> {
	return toCounts(await query<{ status: Status; n: number }>(COUNT_SQL));
}

export function getTracking(id: number) {
	return queryOne<Tracking>('SELECT * FROM trackings WHERE id = ?', [id]);
}

export function getEvents(trackingId: number) {
	return query<StatusEvent>(
		'SELECT * FROM status_events WHERE tracking_id = ? ORDER BY at DESC, id DESC',
		[trackingId]
	);
}

export type AddOutcome =
	| { ok: true; id: number; tracking_no: string | null }
	| { ok: false; error: string };

/**
 * Insert one tracking. The number is normalised (whitespace removed, upper-cased)
 * so duplicates are caught regardless of how they were typed. A null number means
 * the supplier has not provided one yet; a comment is then required so the row is
 * still recognisable.
 */
export async function addTracking(
	rawNumber: string | null,
	meta: { notes?: string | null; ordered_at?: number | null; destination: Destination }
): Promise<AddOutcome> {
	await ensureSchema();
	const now = Date.now();
	const orderedAt = meta.ordered_at ?? now;
	const notes = meta.notes?.trim() || null;

	const no = rawNumber === null ? null : normalizeTrackingNo(rawNumber);
	if (no !== null) {
		if (!no) return { ok: false, error: 'Enter a tracking number' };
		if (no.length < 4 || no.length > 64) return { ok: false, error: 'Tracking number must be 4-64 characters' };
		const existing = await queryOne<{ id: number }>('SELECT id FROM trackings WHERE tracking_no = ?', [no]);
		if (existing) return { ok: false, error: `${no} already exists` };
	} else if (!notes) {
		return { ok: false, error: 'Add a comment so you can recognise this order until the tracking arrives' };
	}

	const tx = await db.transaction('write');
	try {
		const ins = await tx.execute({
			sql: `INSERT INTO trackings (tracking_no, notes, destination, status, ordered_at, created_at, updated_at)
				VALUES (?, ?, ?, 'ordered', ?, ?, ?)`,
			args: [no, notes, meta.destination, orderedAt, now, now]
		});
		await tx.execute({
			sql: `INSERT INTO status_events (tracking_id, from_status, to_status, note, at) VALUES (?, NULL, 'ordered', NULL, ?)`,
			args: [ins.lastInsertRowid!, orderedAt]
		});
		await tx.commit();
		return { ok: true, id: Number(ins.lastInsertRowid), tracking_no: no };
	} catch (e) {
		await tx.rollback();
		// Race: another request inserted the same number between our check and insert.
		if (String(e).includes('UNIQUE')) return { ok: false, error: `${no} already exists` };
		throw e;
	}
}

export interface TransitionOptions {
	receipt_ref?: string | null;
	receipt_photo_id?: number | null;
	note?: string | null;
	/** Override the timestamp (e.g. user says it arrived yesterday). */
	at?: number;
}

/** Move a tracking to a new status and log the event. */
export async function setStatus(
	id: number,
	to: Status,
	opts: TransitionOptions = {}
): Promise<Tracking | null> {
	if (!isStatus(to)) throw new Error(`Invalid status: ${to}`);
	const current = await getTracking(id);
	if (!current) return null;
	if (!current.tracking_no && to !== 'ordered' && to !== 'lost') {
		throw new Error('Add the tracking number first; an order without one cannot move past Ordered');
	}

	const at = opts.at ?? Date.now();
	const sets: string[] = ['status = ?', 'updated_at = ?'];
	const args: (string | number | null)[] = [to, Date.now()];

	// Stamp the date for the step reached; earlier steps that were skipped get
	// the same date so the timeline stays consistent. Moving backwards clears
	// the later steps.
	const ORDER: Status[] = ['ordered', 'delivered', 'warehoused', 'received'];
	const idx = ORDER.indexOf(to);
	if (idx >= 0) {
		const stamped = {
			delivered: current.delivered_at,
			warehoused: current.warehoused_at,
			received: current.received_at
		} as const;
		const movingBack = ORDER.indexOf(current.status) > idx;
		for (let i = 1; i < ORDER.length; i++) {
			const step = ORDER[i] as keyof typeof stamped;
			const col = `${step}_at`;
			if (i > idx) {
				sets.push(`${col} = NULL`);
			} else if (i === idx && !(movingBack && stamped[step] && opts.at === undefined)) {
				// Reopening keeps the original date unless one was given explicitly.
				sets.push(`${col} = ?`);
				args.push(at);
			} else if (i < idx && !stamped[step]) {
				sets.push(`${col} = ?`);
				args.push(at);
			}
		}
	}

	if (opts.receipt_ref !== undefined) {
		sets.push('receipt_ref = ?');
		args.push(opts.receipt_ref);
	}
	if (opts.receipt_photo_id !== undefined) {
		sets.push('receipt_photo_id = ?');
		args.push(opts.receipt_photo_id);
	}

	args.push(id);

	const tx = await db.transaction('write');
	try {
		await tx.execute({ sql: `UPDATE trackings SET ${sets.join(', ')} WHERE id = ?`, args });
		if (current.status !== to) {
			await tx.execute({
				sql: `INSERT INTO status_events (tracking_id, from_status, to_status, note, at) VALUES (?, ?, ?, ?, ?)`,
				args: [id, current.status, to, opts.note ?? null, at]
			});
		}
		await tx.commit();
	} catch (e) {
		await tx.rollback();
		throw e;
	}
	return getTracking(id);
}

export interface UpdateFields {
	destination?: Destination;
	/** null clears the number (tracking not yet known) */
	tracking_no?: string | null;
	supplier?: string | null;
	description?: string | null;
	receipt_ref?: string | null;
	receipt_photo_id?: number | null;
	notes?: string | null;
	ordered_at?: number;
	delivered_at?: number | null;
	warehoused_at?: number | null;
	received_at?: number | null;
}

/** Edit descriptive fields. Returns an error string on duplicate tracking number. */
export async function updateTracking(id: number, fields: UpdateFields): Promise<string | null> {
	const sets: string[] = [];
	const args: (string | number | null)[] = [];

	if (fields.tracking_no !== undefined) {
		const no = fields.tracking_no === null ? null : normalizeTrackingNo(fields.tracking_no) || null;
		if (no === null) {
			const notes = fields.notes !== undefined ? fields.notes : (await getTracking(id))?.notes;
			if (!notes) return 'Without a tracking number a comment is required';
		} else {
			if (no.length < 4 || no.length > 64) return 'Tracking number must be 4-64 characters';
			const clash = await queryOne<{ id: number }>(
				'SELECT id FROM trackings WHERE tracking_no = ? AND id != ?',
				[no, id]
			);
			if (clash) return `Tracking number ${no} already exists`;
		}
		sets.push('tracking_no = ?');
		args.push(no);
	}
	for (const key of [
		'destination',
		'supplier',
		'description',
		'receipt_ref',
		'receipt_photo_id',
		'notes',
		'ordered_at',
		'delivered_at',
		'warehoused_at',
		'received_at'
	] as const) {
		if (fields[key] !== undefined) {
			sets.push(`${key} = ?`);
			args.push(fields[key] as string | number | null);
		}
	}
	if (!sets.length) return null;
	sets.push('updated_at = ?');
	args.push(Date.now(), id);
	await run(`UPDATE trackings SET ${sets.join(', ')} WHERE id = ?`, args);
	return null;
}

export async function deleteTracking(id: number) {
	await run('DELETE FROM trackings WHERE id = ?', [id]);
}

/** Append a phrase to the comment of several trackings (used after sending an alert). */
export async function appendNote(ids: number[], phrase: string) {
	for (const id of ids) {
		const t = await getTracking(id);
		if (!t) continue;
		const parts = (t.notes ?? '').split(/[,\n]/).map((p) => p.trim().toLowerCase());
		if (parts.includes(phrase.toLowerCase())) continue;
		const base = (t.notes ?? '').trim().replace(/,\s*$/, '');
		await updateTracking(id, { notes: base ? `${base}, ${phrase}` : phrase });
	}
}
