import { createClient, type InValue } from '@libsql/client';
import { env } from '$env/dynamic/private';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const url = env.DATABASE_URL || 'file:data/trackings.db';
if (url.startsWith('file:')) mkdirSync(dirname(url.slice(5)), { recursive: true });

export const db = createClient({ url, authToken: env.DATABASE_AUTH_TOKEN || undefined });

const CURRENT_VERSION = '4';

const STATUS_CHECK = `CHECK (status IN ('ordered','delivered','warehoused','received','lost'))`;

const TRACKINGS_COLUMNS = `
		id            INTEGER PRIMARY KEY AUTOINCREMENT,
		tracking_no   TEXT UNIQUE,
		supplier      TEXT,
		description   TEXT,
		status        TEXT NOT NULL DEFAULT 'ordered' ${STATUS_CHECK},
		destination   TEXT NOT NULL DEFAULT 'PK',
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

/** Rebuild `trackings` with the current column definition, copying data through `selectSql`. */
async function rebuildTrackings(selectSql: string, version: string) {
	await db.execute('PRAGMA foreign_keys = OFF');
	const tx = await db.transaction('write');
	try {
		await tx.execute(`CREATE TABLE trackings_new (${TRACKINGS_COLUMNS})`);
		await tx.execute(`INSERT INTO trackings_new (id, tracking_no, supplier, description, status, destination, receipt_ref,
			receipt_photo_id, notes, ordered_at, delivered_at, warehoused_at, received_at, created_at, updated_at) ${selectSql}`);
		await tx.execute(`DROP TABLE trackings`);
		await tx.execute(`ALTER TABLE trackings_new RENAME TO trackings`);
		await tx.execute(`CREATE INDEX IF NOT EXISTS idx_trackings_status ON trackings(status)`);
		await tx.execute({ sql: `INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('version', ?)`, args: [version] });
		await tx.commit();
	} catch (e) {
		await tx.rollback();
		throw e;
	} finally {
		await db.execute('PRAGMA foreign_keys = ON');
	}
}

async function migrate() {
	const cols = (await db.execute(`PRAGMA table_info(trackings)`)).rows as unknown as {
		name: string;
		notnull: number;
	}[];
	const hasReceivedAt = cols.some((c) => c.name === 'received_at');
	const trackingNoRequired = cols.find((c) => c.name === 'tracking_no')?.notnull === 1;

	// v2: statuses became ordered -> delivered (at warehouse, no receipt) -> warehoused -> received.
	// Old "delivered" rows meant "received": rename them and move the timestamp.
	if (!hasReceivedAt) {
		await rebuildTrackings(
			`SELECT id, tracking_no, supplier, description,
				CASE status WHEN 'delivered' THEN 'received' ELSE status END,
				'PK', receipt_ref, receipt_photo_id, notes, ordered_at,
				NULL, warehoused_at,
				CASE status WHEN 'delivered' THEN delivered_at ELSE NULL END,
				created_at, updated_at FROM trackings`,
			'3'
		);
		await db.execute(`UPDATE status_events SET to_status = 'received' WHERE to_status = 'delivered'`);
		await db.execute(`UPDATE status_events SET from_status = 'received' WHERE from_status = 'delivered'`);
		return;
	}

	// v4: destination country. Everything that existed before was going to Pakistan.
	if (!cols.some((c) => c.name === 'destination')) {
		await db.execute(`ALTER TABLE trackings ADD COLUMN destination TEXT NOT NULL DEFAULT 'PK'`);
	}

	// v3: tracking_no may be NULL (order placed, supplier has not given a number yet).
	if (trackingNoRequired) {
		await rebuildTrackings(
			`SELECT id, tracking_no, supplier, description, status, 'PK', receipt_ref, receipt_photo_id,
				notes, ordered_at, delivered_at, warehoused_at, received_at, created_at, updated_at FROM trackings`,
			'3'
		);
	}
}

let ready: Promise<void> | null = null;

/** Creates tables on first use and applies migrations. Safe to call many times. */
export function ensureSchema(): Promise<void> {
	if (!ready) {
		ready = (async () => {
			// One round trip for all CREATE IF NOT EXISTS statements plus the version read.
			const results = await db.batch(
				[
					'PRAGMA foreign_keys = ON',
					...schema,
					`SELECT value FROM schema_meta WHERE key = 'version'`
				],
				'write'
			);
			const version = results[results.length - 1].rows[0]?.value;
			if (version === CURRENT_VERSION) return; // fast path: nothing to migrate
			await migrate();
			await db.execute({
				sql: `INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('version', ?)`,
				args: [CURRENT_VERSION]
			});
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

/** Run several read queries in one round trip. */
export async function queryMany<T extends unknown[][]>(
	stmts: { sql: string; args?: InValue[] }[]
): Promise<T> {
	await ensureSchema();
	const res = await db.batch(
		stmts.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
		'read'
	);
	return res.map((r) => r.rows) as unknown as T;
}
