import { createClient, type InValue } from '@libsql/client';
import { env } from '$env/dynamic/private';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const url = env.DATABASE_URL || 'file:data/trackings.db';
if (url.startsWith('file:')) mkdirSync(dirname(url.slice(5)), { recursive: true });

export const db = createClient({ url, authToken: env.DATABASE_AUTH_TOKEN || undefined });

const STATUS_CHECK = `CHECK (status IN ('ordered','delivered','warehoused','received','lost'))`;

const TRACKINGS_COLUMNS = `
		id            INTEGER PRIMARY KEY AUTOINCREMENT,
		tracking_no   TEXT NOT NULL UNIQUE,
		supplier      TEXT,
		description   TEXT,
		status        TEXT NOT NULL DEFAULT 'ordered' ${STATUS_CHECK},
		receipt_ref   TEXT,
		receipt_photo_id INTEGER REFERENCES photos(id) ON DELETE SET NULL,
		notes         TEXT,
		ordered_at    INTEGER NOT NULL,
		delivered_at  INTEGER,
		warehoused_at INTEGER,
		received_at   INTEGER,
		created_at    INTEGER NOT NULL,
		updated_at    INTEGER NOT NULL`;

const schema = [
	`CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
	`CREATE TABLE IF NOT EXISTS photos (
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		mime       TEXT NOT NULL,
		size       INTEGER NOT NULL,
		data       BLOB NOT NULL,
		created_at INTEGER NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS trackings (${TRACKINGS_COLUMNS})`,
	`CREATE INDEX IF NOT EXISTS idx_trackings_status ON trackings(status)`,
	`CREATE TABLE IF NOT EXISTS status_events (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		tracking_id INTEGER NOT NULL REFERENCES trackings(id) ON DELETE CASCADE,
		from_status TEXT,
		to_status   TEXT NOT NULL,
		note        TEXT,
		at          INTEGER NOT NULL
	)`,
	`CREATE INDEX IF NOT EXISTS idx_events_tracking ON status_events(tracking_id)`
];

/**
 * v2: statuses became ordered -> delivered (at warehouse, no receipt) -> warehoused
 * -> received (at home). Old "delivered" rows meant "received", so they are renamed
 * and their timestamp moves to the new received_at column. SQLite cannot alter a
 * CHECK constraint, so the table is rebuilt.
 */
async function migrateToV2() {
	const cols = await db.execute(`PRAGMA table_info(trackings)`);
	const hasReceivedAt = cols.rows.some((r) => r.name === 'received_at');
	if (hasReceivedAt) return;

	await db.execute('PRAGMA foreign_keys = OFF');
	const tx = await db.transaction('write');
	try {
		await tx.execute(`CREATE TABLE trackings_v2 (${TRACKINGS_COLUMNS})`);
		await tx.execute(`
			INSERT INTO trackings_v2 (id, tracking_no, supplier, description, status, receipt_ref, receipt_photo_id,
				notes, ordered_at, delivered_at, warehoused_at, received_at, created_at, updated_at)
			SELECT id, tracking_no, supplier, description,
				CASE status WHEN 'delivered' THEN 'received' ELSE status END,
				receipt_ref, receipt_photo_id, notes, ordered_at,
				NULL,
				warehoused_at,
				CASE status WHEN 'delivered' THEN delivered_at ELSE NULL END,
				created_at, updated_at
			FROM trackings`);
		await tx.execute(`DROP TABLE trackings`);
		await tx.execute(`ALTER TABLE trackings_v2 RENAME TO trackings`);
		await tx.execute(`CREATE INDEX IF NOT EXISTS idx_trackings_status ON trackings(status)`);
		await tx.execute(`UPDATE status_events SET to_status = 'received' WHERE to_status = 'delivered'`);
		await tx.execute(`UPDATE status_events SET from_status = 'received' WHERE from_status = 'delivered'`);
		await tx.execute(`INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('version', '2')`);
		await tx.commit();
	} catch (e) {
		await tx.rollback();
		throw e;
	} finally {
		await db.execute('PRAGMA foreign_keys = ON');
	}
}

let ready: Promise<void> | null = null;

/** Creates tables on first use and applies migrations. Safe to call many times. */
export function ensureSchema(): Promise<void> {
	if (!ready) {
		ready = (async () => {
			await db.execute('PRAGMA foreign_keys = ON');
			for (const sql of schema) await db.execute(sql);
			await migrateToV2();
		})();
	}
	return ready;
}

/** Run a query and get typed rows back. */
export async function query<T>(sql: string, args: InValue[] = []): Promise<T[]> {
	await ensureSchema();
	const res = await db.execute({ sql, args });
	return res.rows as unknown as T[];
}

export async function queryOne<T>(sql: string, args: InValue[] = []): Promise<T | null> {
	const rows = await query<T>(sql, args);
	return rows[0] ?? null;
}

export async function run(sql: string, args: InValue[] = []) {
	await ensureSchema();
	return db.execute({ sql, args });
}
