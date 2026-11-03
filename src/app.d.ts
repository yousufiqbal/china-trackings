// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user: string | null;
			/** User's UTC offset in minutes, from the tz cookie. */
			tz: number;
		}
	}
}

export {};
