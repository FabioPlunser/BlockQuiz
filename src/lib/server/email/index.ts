import { logger } from '$lib/logs/logger';
import { sendViaFile } from './drivers/file';
import { sendViaSmtp } from './drivers/smtp';
import { sendViaGraph } from './drivers/graph';
import { getEmailConfig, type EmailDriver } from '$lib/server/settings';

export interface EmailMessage {
	to: string;
	subject: string;
	text: string;
	html?: string;
}

export type { EmailDriver };

export async function sendEmail(message: EmailMessage): Promise<void> {
	const config = await getEmailConfig();
	const driver = config.driver;
	try {
		if (driver === 'smtp') {
			await sendViaSmtp(message, config);
			return;
		}
		if (driver === 'graph') {
			await sendViaGraph(message, config);
			return;
		}
		await sendViaFile(message);
	} catch (cause) {
		logger.error('Email send failed', {
			driver,
			to: message.to,
			subject: message.subject,
			cause: cause instanceof Error ? cause.message : String(cause)
		});
		// Always fall back to file so the reset link is never lost during config issues.
		if (driver !== 'file') {
			await sendViaFile(message);
		} else {
			throw cause;
		}
	}
}
