import { createClient, type InValue } from '@libsql/client';
import { env } from '$env/dynamic/private';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const url = env.DATABASE_URL || 'file:data/trackings.db';
if (url.startsWith('file:')) mkdirSync(dirname(url.slice(5)), { recursive: true });

export const db = createClient({ url, authToken: env.DATABASE_AUTH_TOKEN || undefined });

const schema = [
	`CREATE TABLE IF NOT EXISTS photos (
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		mime       TEXT NOT NULL,
		size       INTEGER NOT NULL,
		data       BLOB NOT NULL,
		created_at INTEGER NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS trackings (
		id            INTEGER PRIMARY KEY AUTOINCREMENT,
		tracking_no   TEXT NOT NULL UNIQUE,
		supplier      TEXT,
		description   TEXT,
		status        TEXT NOT NULL DEFAULT 'ordered'
		              CHECK (status IN ('ordered','warehoused','delivered','lost')),
		receipt_ref   TEXT,
		receipt_photo_id INTEGER REFERENCES photos(id) ON DELETE SET NULL,
		notes         TEXT,
		ordered_at    INTEGER NOT NULL,
		warehoused_at INTEGER,
		delivered_at  INTEGER,
		created_at    INTEGER NOT NULL,
		updated_at    INTEGER NOT NULL
	)`,
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

let ready: Promise<void> | null = null;

/** Creates tables on first use. Safe to call many times. */
export function ensureSchema(): Promise<void> {
	if (!ready) {
		ready = (async () => {
			await db.execute('PRAGMA foreign_keys = ON');
			for (const sql of schema) await db.execute(sql);
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
