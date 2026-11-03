import type { LayoutServerLoad } from './$types';
import { track17Enabled } from '$lib/server/track17';

export const load: LayoutServerLoad = ({ locals }) => {
	return { user: locals.user, tz: locals.tz, courierEnabled: track17Enabled() };
};
