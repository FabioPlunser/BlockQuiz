import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '$db';
import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from 'better-auth/svelte-kit';
export const auth = betterAuth({
	plugins: [sveltekitCookies(getRequestEvent)],
	database: drizzleAdapter(db, {
		provider: 'sqlite'
	}),
	emailAndPassword: {
		enabled: true
	},
	user: {
		additionalFields: {
			role: {
				type: 'string',
				required: true
			},
			active: {
				type: 'boolean',
				required: true,
				defaultValue: true
			}
		}
	}
});
