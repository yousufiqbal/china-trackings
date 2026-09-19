import { db, ensureSchema, query, queryOne, run } from './db';
import {
	isStatus,
	normalizeTrackingNo,
	type Status,
	type StatusEvent,
	type Tracking
} from '$lib/trackings';

export interface ListFilter {
	status?: Status | 'active' | 'all';
	q?: string;
}

export async function listTrackings(filter: ListFilter = {}): Promise<Tracking[]> {
	const where: string[] = [];
	const args: (string | number)[] = [];

	if (filter.status === 'active' || !filter.status) {
		where.push(`status IN ('ordered','warehoused')`);
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
		ORDER BY CASE status WHEN 'ordered' THEN 0 WHEN 'warehoused' THEN 1 WHEN 'lost' THEN 2 ELSE 3 END,
		updated_at DESC`;
	return query<Tracking>(sql, args);
}

export async function countByStatus(): Promise<Record<Status, number>> {
	const rows = await query<{ status: Status; n: number }>(
		'SELECT status, COUNT(*) AS n FROM trackings GROUP BY status'
	);
	const out: Record<Status, number> = { ordered: 0, warehoused: 0, delivered: 0, lost: 0 };
	for (const r of rows) out[r.status] = Number(r.n);
	return out;
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

export interface AddResult {
	added: string[];
	duplicates: string[];
	invalid: string[];
}

/**
 * Bulk-insert tracking numbers. Numbers are normalised (whitespace removed,
 * upper-cased) so duplicates are caught regardless of how they were typed.
 */
export async function addTrackings(
	rawNumbers: string[],
	meta: { supplier?: string; description?: string; notes?: string; ordered_at?: number | null }
): Promise<AddResult> {
	await ensureSchema();
	const result: AddResult = { added: [], duplicates: [], invalid: [] };
	const seen = new Set<string>();
	const now = Date.now();
	const orderedAt = meta.ordered_at ?? now;

	for (const raw of rawNumbers) {
		const no = normalizeTrackingNo(raw);
		if (!no) continue;
		if (no.length < 4 || no.length > 64) {
			result.invalid.push(no);
			continue;
		}
		if (seen.has(no)) {
			result.duplicates.push(no);
			continue;
		}
		seen.add(no);

		const existing = await queryOne<{ id: number }>(
			'SELECT id FROM trackings WHERE tracking_no = ?',
			[no]
		);
		if (existing) {
			result.duplicates.push(no);
			continue;
		}

		const tx = await db.transaction('write');
		try {
			const ins = await tx.execute({
				sql: `INSERT INTO trackings (tracking_no, supplier, description, notes, status, ordered_at, created_at, updated_at)
					VALUES (?, ?, ?, ?, 'ordered', ?, ?, ?)`,
				args: [no, meta.supplier || null, meta.description || null, meta.notes || null, orderedAt, now, now]
			});
			await tx.execute({
				sql: `INSERT INTO status_events (tracking_id, from_status, to_status, note, at) VALUES (?, NULL, 'ordered', NULL, ?)`,
				args: [ins.lastInsertRowid!, orderedAt]
			});
			await tx.commit();
			result.added.push(no);
		} catch (e) {
			await tx.rollback();
			// Race: another request inserted the same number between our check and insert.
			if (String(e).includes('UNIQUE')) result.duplicates.push(no);
			else throw e;
		}
	}
	return result;
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

	const at = opts.at ?? Date.now();
	const sets: string[] = ['status = ?', 'updated_at = ?'];
	const args: (string | number | null)[] = [to, Date.now()];

	if (to === 'warehoused') {
		sets.push('warehoused_at = ?');
		args.push(at);
	} else if (to === 'delivered') {
		sets.push('delivered_at = ?');
		args.push(at);
		if (!current.warehoused_at) {
			sets.push('warehoused_at = ?');
			args.push(at);
		}
	} else if (to === 'ordered') {
		// Reopening: clear downstream timestamps.
		sets.push('warehoused_at = NULL', 'delivered_at = NULL');
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
	tracking_no?: string;
	supplier?: string | null;
	description?: string | null;
	receipt_ref?: string | null;
	receipt_photo_id?: number | null;
	notes?: string | null;
	ordered_at?: number;
	warehoused_at?: number | null;
	delivered_at?: number | null;
}

/** Edit descriptive fields. Returns an error string on duplicate tracking number. */
export async function updateTracking(id: number, fields: UpdateFields): Promise<string | null> {
	const sets: string[] = [];
	const args: (string | number | null)[] = [];

	if (fields.tracking_no !== undefined) {
		const no = normalizeTrackingNo(fields.tracking_no);
		if (!no) return 'Tracking number cannot be empty';
		const clash = await queryOne<{ id: number }>(
			'SELECT id FROM trackings WHERE tracking_no = ? AND id != ?',
			[no, id]
		);
		if (clash) return `Tracking number ${no} already exists`;
		sets.push('tracking_no = ?');
		args.push(no);
	}
	for (const key of [
		'supplier',
		'description',
		'receipt_ref',
		'receipt_photo_id',
		'notes',
		'ordered_at',
		'warehoused_at',
		'delivered_at'
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
