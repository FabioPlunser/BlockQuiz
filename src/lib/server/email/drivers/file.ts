import { env } from '$env/dynamic/private';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EmailMessage } from '../index';

const outboxDir = env.EMAIL_OUTBOX_DIR ?? env.PASSWORD_RESET_OUTBOX_DIR ?? join(process.cwd(), 'data', 'outbox');

export async function sendViaFile(message: EmailMessage): Promise<void> {
	await mkdir(outboxDir, { recursive: true });
	const filename = `${Date.now()}-${message.to.replace(/[^a-z0-9._-]/gi, '_')}.txt`;
	const body = [`To: ${message.to}`, `Subject: ${message.subject}`, '', message.text].join('\n');
	await writeFile(join(outboxDir, filename), body, 'utf8');
}
