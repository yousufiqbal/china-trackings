import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';

export const SESSION_COOKIE = 'session';
const SESSION_DAYS = 30;

function secret(): string {
	const s = env.SESSION_SECRET;
	if (!s || s.length < 16) throw new Error('SESSION_SECRET missing or too short (set it in .env)');
	return s;
}

function safeEqual(a: string, b: string): boolean {
	const ba = Buffer.from(a);
	const bb = Buffer.from(b);
	if (ba.length !== bb.length) return false;
	return timingSafeEqual(ba, bb);
}

function sign(payload: string): string {
	return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function checkCredentials(user: string, pass: string): boolean {
	const expectedUser = env.ADMIN_USER ?? '';
	const expectedPass = env.ADMIN_PASS ?? '';
	if (!expectedUser || !expectedPass) return false;
	// Username is case-insensitive (it is usually an email); password is not.
	// Evaluate both so timing does not reveal which field was wrong.
	const u = safeEqual(user.toLowerCase(), expectedUser.toLowerCase());
	const p = safeEqual(pass, expectedPass);
	return u && p;
}

export function createSession(cookies: Cookies, user: string) {
	const exp = Date.now() + SESSION_DAYS * 86_400_000;
	// Username is base64url-encoded so dots (emails) do not break the cookie format.
	const payload = `${Buffer.from(user).toString('base64url')}.${exp}`;
	cookies.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: SESSION_DAYS * 86_400
	});
}

export function destroySession(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

/** Returns the username if the session cookie is valid and unexpired. */
export function readSession(cookies: Cookies): string | null {
	const raw = cookies.get(SESSION_COOKIE);
	if (!raw) return null;
	const parts = raw.split('.');
	if (parts.length !== 3) return null;
	const [userB64, expStr, sig] = parts;
	const payload = `${userB64}.${expStr}`;
	if (!safeEqual(sig, sign(payload))) return null;
	if (Number(expStr) < Date.now()) return null;
	const user = Buffer.from(userB64, 'base64url').toString();
	if (user.toLowerCase() !== (env.ADMIN_USER ?? '').toLowerCase()) return null;
	return user;
}
