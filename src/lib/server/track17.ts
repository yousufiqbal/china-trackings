import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { CourierEvent, CourierStatus } from '$lib/trackings';

// 17TRACK API v2.4: https://api.17track.net/en/doc
const BASE = 'https://api.17track.net/track/v2.4';
/** Most endpoints accept at most 40 numbers per request. */
const BATCH = 40;
const ALREADY_REGISTERED = -18019901;

export function track17Enabled(): boolean {
	return !!env.TRACK17_KEY;
}

interface Rejected {
	number: string;
	error: { code: number; message: string };
}

interface RawEvent {
	time_iso?: string | null;
	time_utc?: string | null;
	description?: string | null;
	description_translation?: { description?: string | null } | null;
	location?: string | null;
}

export interface TrackInfo {
	latest_status?: { status?: CourierStatus | null } | null;
	latest_event?: RawEvent | null;
	tracking?: {
		providers?: { provider?: { name?: string | null } | null; events?: RawEvent[] | null }[] | null;
	} | null;
}

async function call<T>(path: string, body: unknown): Promise<{ accepted: T[]; rejected: Rejected[] }> {
	const res = await fetch(BASE + path, {
		method: 'POST',
		headers: { '17token': env.TRACK17_KEY ?? '', 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(15_000)
	});
	if (res.status === 401) throw new Error('17TRACK rejected the API key (check TRACK17_KEY)');
	if (!res.ok) throw new Error(`17TRACK ${path}: HTTP ${res.status}`);
	const json = await res.json();
	if (json.code !== 0) {
		const msg = json.data?.errors?.[0]?.message ?? 'unknown error';
		throw new Error(`17TRACK ${path}: ${json.code} ${msg}`);
	}
	return { accepted: json.data?.accepted ?? [], rejected: json.data?.rejected ?? [] };
}

async function batched<T>(path: string, numbers: string[]) {
	const accepted: T[] = [];
	const rejected: Rejected[] = [];
	for (let i = 0; i < numbers.length; i += BATCH) {
		const r = await call<T>(path, numbers.slice(i, i + BATCH).map((number) => ({ number })));
		accepted.push(...r.accepted);
		rejected.push(...r.rejected);
	}
	return { accepted, rejected };
}

/**
 * Start tracking numbers (costs 1 quota each; already registered ones are free
 * and count as success). 17TRACK then polls the courier every 6-12 hours.
 * Returns the numbers that could not be registered, with the reason.
 */
export async function register(numbers: string[]): Promise<Rejected[]> {
	if (!numbers.length) return [];
	const { rejected } = await batched('/register', numbers);
	return rejected.filter((r) => r.error?.code !== ALREADY_REGISTERED);
}

/** Latest stored tracking data for registered numbers (no quota cost). */
export async function getTrackInfo(numbers: string[]) {
	if (!numbers.length) return { accepted: [], rejected: [] };
	return batched<{ number: string; track_info: TrackInfo | null }>('/gettrackinfo', numbers);
}

/** Verify a webhook push: sign = sha256hex(rawBody + "/" + key). */
export function verifySignature(rawBody: string, sign: string | null): boolean {
	const key = env.TRACK17_KEY;
	if (!key || !sign) return false;
	const expected = createHash('sha256').update(`${rawBody}/${key}`).digest('hex');
	const a = Buffer.from(expected);
	const b = Buffer.from(sign.toLowerCase());
	return a.length === b.length && timingSafeEqual(a, b);
}

function toEvent(e: RawEvent): CourierEvent {
	const t = Date.parse(e.time_utc ?? e.time_iso ?? '');
	return {
		at: Number.isNaN(t) ? null : t,
		text: (e.description_translation?.description || e.description || '').trim(),
		location: e.location?.trim() || null
	};
}

/** Flatten 17TRACK's track_info into our courier_* columns. */
export function toCourierFields(info: TrackInfo | null | undefined) {
	const providers = info?.tracking?.providers ?? [];
	const events = providers
		.flatMap((p) => p.events ?? [])
		.map(toEvent)
		.filter((e) => e.text)
		.sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
		.slice(0, 50);
	const latest = info?.latest_event ? toEvent(info.latest_event) : events[0];
	return {
		courier: providers.find((p) => p.provider?.name)?.provider?.name ?? null,
		courier_status: info?.latest_status?.status ?? null,
		courier_event: latest?.text || null,
		courier_event_at: latest?.at ?? null,
		courier_events: events.length ? JSON.stringify(events) : null
	};
}
