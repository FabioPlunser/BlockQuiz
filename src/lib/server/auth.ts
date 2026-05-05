import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '$db/client';
import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { logger } from '$lib/logs/logger';

const authPort = env.PORT ?? (env.NODE_ENV === 'production' ? '3000' : '5173');
const isProductionRuntime = env.NODE_ENV === 'production' && !building;

if (isProductionRuntime && !env.BETTER_AUTH_URL) {
	throw new Error('BETTER_AUTH_URL is required in production');
}

if (isProductionRuntime && !env.AUTH_SECRET) {
	throw new Error('AUTH_SECRET is required in production');
}

const authBaseURL = env.BETTER_AUTH_URL ?? `http://localhost:${authPort}`;
const outboxDir = env.PASSWORD_RESET_OUTBOX_DIR ?? join(process.cwd(), 'data', 'outbox');

async function hashPassword(password: string) {
	return Bun.password.hash(password);
}

async function verifyPassword({ hash, password }: { hash: string; password: string }) {
	return Bun.password.verify(password, hash);
}

async function deliverResetUrl(email: string, url: string) {
	logger.info('Password reset requested', { email, url });

	try {
		await mkdir(outboxDir, { recursive: true });
		const filename = `${Date.now()}-${email.replace(/[^a-z0-9._-]/gi, '_')}.txt`;
		const body = [
			`To: ${email}`,
			`Subject: BlockQuiz password reset`,
			'',
			'A password reset was requested for your BlockQuiz account.',
			'',
			`Reset URL: ${url}`,
			'',
			'If you did not request this reset, you can ignore this message.'
		].join('\n');
		await writeFile(join(outboxDir, filename), body, 'utf8');
	} catch (cause) {
		logger.warn('Failed to write password reset outbox file', {
			email,
			cause: cause instanceof Error ? cause.message : String(cause)
		});
	}
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
		sendResetPassword: async ({ user, url }) => {
			await deliverResetUrl(user.email, url);
		},
		resetPasswordTokenExpiresIn: 60 * 60
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
