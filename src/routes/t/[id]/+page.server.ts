import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getTracking } from '$lib/server/trackings';

// Deep link to one tracking. All mutations post to the dashboard route's actions.
export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Not found');
	const tracking = await getTracking(id);
	if (!tracking) error(404, 'Tracking not found');
	return { tracking, now: Date.now() };
};
