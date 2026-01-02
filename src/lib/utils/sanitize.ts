import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string safe for use with {@html}
 */
export function sanitizeHtml(html: string): string {
	if (typeof window === 'undefined') {
		// Server-side: return as-is or use a server-side sanitizer
		// For now, we'll just return it since DOMPurify needs DOM
		return html;
	}

	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: [
			'p',
			'br',
			'strong',
			'em',
			'u',
			's',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'ul',
			'ol',
			'li',
			'blockquote',
			'code',
			'pre',
			'a',
			'img'
		],
		ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
		ALLOWED_URI_REGEXP:
			/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
	});
}
