import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '$db/client';
import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from 'better-auth/svelte-kit';
export const auth = betterAuth({
	plugins: [sveltekitCookies(getRequestEvent)],
	database: drizzleAdapter(db, {
		provider: 'sqlite'
	}),
	emailAndPassword: {
		enabled: true,
		sendResetPassword: async ({ user, url, token }, request) => {
			// DON'T send email - just skip it
			// Token is already saved in database by better-auth
			console.log(user);
			console.log(url);
			console.log(token);
			console.log(`Reset token created for ${user.email}`);
		}
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
