import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { checkCredentials, createSession } from '$lib/server/auth';

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (!checkCredentials(username, password)) {
			return fail(401, { error: 'Wrong username or password', username });
		}

		createSession(cookies, username.toLowerCase());

		const next = url.searchParams.get('next');
		redirect(303, next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
	}
};
