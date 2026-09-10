import type { EmailMessage } from '../index';
import type { EmailConfig } from '$lib/server/settings';

interface CachedToken {
	key: string;
	token: string;
	expiresAt: number;
}

let cachedToken: CachedToken | null = null;

async function getAccessToken(tenant: string, clientId: string, clientSecret: string): Promise<string> {
	const key = `${tenant}:${clientId}`;
	const now = Date.now();
	if (cachedToken && cachedToken.key === key && cachedToken.expiresAt > now + 60_000) {
		return cachedToken.token;
	}

	const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			scope: 'https://graph.microsoft.com/.default',
			grant_type: 'client_credentials'
		})
	});

	if (!response.ok) {
		throw new Error(`Graph token request failed: ${response.status} ${await response.text()}`);
	}

	const json = (await response.json()) as { access_token: string; expires_in: number };
	cachedToken = {
		key,
		token: json.access_token,
		expiresAt: now + json.expires_in * 1000
	};
	return cachedToken.token;
}

export async function sendViaGraph(message: EmailMessage, config: EmailConfig): Promise<void> {
	const { graph } = config;
	if (!graph.tenantId || !graph.clientId || !graph.clientSecret) {
		throw new Error('Graph tenantId, clientId, and clientSecret must be set');
	}
	const fromUser = graph.fromUser ?? config.from;
	if (!fromUser) {
		throw new Error('Graph fromUser (or email "from") must be set to a mailbox UPN');
	}

	const token = await getAccessToken(graph.tenantId, graph.clientId, graph.clientSecret);
	const response = await fetch(
		`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromUser)}/sendMail`,
		{
			method: 'POST',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				message: {
					subject: message.subject,
					body: {
						contentType: message.html ? 'HTML' : 'Text',
						content: message.html ?? message.text
					},
					toRecipients: [{ emailAddress: { address: message.to } }]
				},
				saveToSentItems: false
			})
		}
	);

	if (!response.ok && response.status !== 202) {
		throw new Error(`Graph sendMail failed: ${response.status} ${await response.text()}`);
	}
}
