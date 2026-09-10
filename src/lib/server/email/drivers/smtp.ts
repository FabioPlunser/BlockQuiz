import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailMessage } from '../index';
import type { EmailConfig } from '$lib/server/settings';

interface CacheKey {
	host: string;
	port: number;
	secure: boolean;
	user?: string;
	password?: string;
}

let cached: { key: string; transporter: Transporter } | null = null;

function getTransporter(key: CacheKey): Transporter {
	const cacheId = JSON.stringify(key);
	if (cached && cached.key === cacheId) return cached.transporter;
	const transporter = nodemailer.createTransport({
		host: key.host,
		port: key.port,
		secure: key.secure,
		auth: key.user && key.password ? { user: key.user, pass: key.password } : undefined
	});
	cached = { key: cacheId, transporter };
	return transporter;
}

export async function sendViaSmtp(message: EmailMessage, config: EmailConfig): Promise<void> {
	const { smtp } = config;
	if (!smtp.host) throw new Error('SMTP host is not configured');
	const port = smtp.port ?? 587;
	const secure = smtp.secure ?? port === 465;
	const from = config.from ?? smtp.user;
	if (!from) throw new Error('Email "from" address (or SMTP user) must be set');

	await getTransporter({
		host: smtp.host,
		port,
		secure,
		user: smtp.user,
		password: smtp.password
	}).sendMail({
		from,
		to: message.to,
		subject: message.subject,
		text: message.text,
		html: message.html
	});
}
