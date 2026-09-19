import { query, queryOne, run } from './db';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']);
// Photos are resized in the browser before upload (usually under 400 KB). This
// is a hard server-side ceiling; hosted Turso rejects very large single rows.
const MAX_BYTES = 4 * 1024 * 1024;

export interface Photo {
	id: number;
	mime: string;
	size: number;
	data: ArrayBuffer;
	created_at: number;
}

/**
 * Store an uploaded image as a BLOB row. Returns the new photo id, null if no
 * file was sent, or throws with a user-facing message.
 */
export async function savePhoto(file: File | null | undefined): Promise<number | null> {
	if (!file || file.size === 0) return null;
	if (!ALLOWED.has(file.type)) throw new Error('Photo must be JPG, PNG, WEBP, HEIC or GIF');
	if (file.size > MAX_BYTES) throw new Error('Photo is larger than 4 MB');

	const bytes = new Uint8Array(await file.arrayBuffer());
	const res = await run('INSERT INTO photos (mime, size, data, created_at) VALUES (?, ?, ?, ?)', [
		file.type,
		bytes.byteLength,
		bytes,
		Date.now()
	]);
	return Number(res.lastInsertRowid);
}

export function getPhoto(id: number) {
	return queryOne<Photo>('SELECT id, mime, size, data, created_at FROM photos WHERE id = ?', [id]);
}

export async function deletePhoto(id: number | null | undefined) {
	if (!id) return;
	await run('DELETE FROM photos WHERE id = ?', [id]);
}

/** Remove photos no tracking points at any more (safety net). */
export async function pruneOrphanPhotos() {
	await query(
		'DELETE FROM photos WHERE id NOT IN (SELECT receipt_photo_id FROM trackings WHERE receipt_photo_id IS NOT NULL)'
	);
}
