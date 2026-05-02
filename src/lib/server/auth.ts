import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '$db/client';
import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

const authPort = env.PORT ?? (env.NODE_ENV === 'production' ? '3000' : '5173');
const isProductionRuntime = env.NODE_ENV === 'production' && !building;

if (isProductionRuntime && !env.BETTER_AUTH_URL) {
	throw new Error('BETTER_AUTH_URL is required in production');
}

if (isProductionRuntime && !env.AUTH_SECRET) {
	throw new Error('AUTH_SECRET is required in production');
}

const authBaseURL = env.BETTER_AUTH_URL ?? `http://localhost:${authPort}`;

async function hashPassword(password: string) {
	return Bun.password.hash(password);
}

async function verifyPassword({ hash, password }: { hash: string; password: string }) {
	return Bun.password.verify(password, hash);
}

export const auth = betterAuth({
	baseURL: authBaseURL,
	secret: env.AUTH_SECRET,
	plugins: [sveltekitCookies(getRequestEvent)],
	database: drizzleAdapter(db, {
		provider: 'sqlite'
	}),
	emailAndPassword: {
		enabled: true,
		password: {
			hash: hashPassword,
			verify: verifyPassword
		},
		sendResetPassword: async () => {}
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
