// Shared (client + server) definitions for tracking statuses.

export const STATUSES = ['ordered', 'warehoused', 'delivered', 'lost'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
	ordered: 'Ordered',
	warehoused: 'Warehoused',
	delivered: 'Delivered',
	lost: 'Lost'
};

export const STATUS_HINT: Record<Status, string> = {
	ordered: 'Supplier shipped, on the way to the China warehouse',
	warehoused: 'Warehouse confirmed receipt, waiting to be sent to you',
	delivered: 'Arrived at your door',
	lost: 'Never arrived'
};

/** The happy-path next step for each status. */
export const NEXT_STATUS: Partial<Record<Status, Status>> = {
	ordered: 'warehoused',
	warehoused: 'delivered'
};

export const ACTIVE_STATUSES: Status[] = ['ordered', 'warehoused'];

/** Days a parcel may sit in a status before it is flagged as stale. */
export const STALE_AFTER_DAYS: Partial<Record<Status, number>> = {
	ordered: 14,
	warehoused: 21
};

export interface Tracking {
	id: number;
	tracking_no: string;
	supplier: string | null;
	description: string | null;
	status: Status;
	receipt_ref: string | null;
	receipt_photo_id: number | null;
	notes: string | null;
	ordered_at: number;
	warehoused_at: number | null;
	delivered_at: number | null;
	created_at: number;
	updated_at: number;
}

export interface StatusEvent {
	id: number;
	tracking_id: number;
	from_status: Status | null;
	to_status: Status;
	note: string | null;
	at: number;
}

export function isStatus(v: unknown): v is Status {
	return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

/** Normalise a tracking number so duplicates with different casing/spacing collide. */
export function normalizeTrackingNo(raw: string): string {
	return raw.replace(/\s+/g, '').toUpperCase();
}

/** Timestamp at which the tracking entered its current status. */
export function statusSince(t: Tracking): number {
	switch (t.status) {
		case 'warehoused':
			return t.warehoused_at ?? t.updated_at;
		case 'delivered':
			return t.delivered_at ?? t.updated_at;
		case 'lost':
			return t.updated_at;
		default:
			return t.ordered_at;
	}
}

export function daysInStatus(t: Tracking, now = Date.now()): number {
	return Math.floor((now - statusSince(t)) / 86_400_000);
}

export function isStale(t: Tracking, now = Date.now()): boolean {
	const limit = STALE_AFTER_DAYS[t.status];
	return limit !== undefined && daysInStatus(t, now) > limit;
}

export function formatDate(ms: number | null | undefined): string {
	if (!ms) return '—';
	return new Date(ms).toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
}

export function formatDateTime(ms: number | null | undefined): string {
	if (!ms) return '—';
	return new Date(ms).toLocaleString(undefined, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/** Today's date as YYYY-MM-DD in the local timezone, for <input type="date"> defaults. */
export function todayInput(now = new Date()): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * Turn a YYYY-MM-DD form value into a timestamp. Today keeps the current time
 * (so ordering within the day is preserved); other days use local noon.
 * Returns null for empty/invalid input.
 */
export function parseDateInput(value: FormDataEntryValue | null | undefined): number | null {
	const s = String(value ?? '').trim();
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
	if (!m) return null;
	const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
	const now = new Date();
	if (y === now.getFullYear() && mo === now.getMonth() + 1 && d === now.getDate()) return now.getTime();
	const t = new Date(y, mo - 1, d, 12).getTime();
	return Number.isNaN(t) ? null : t;
}
