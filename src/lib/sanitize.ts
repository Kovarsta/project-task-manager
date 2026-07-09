const ALLOWED_TAGS = new Set([
	'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
	'h2', 'h3', 'h4',
	'ul', 'ol', 'li',
	'a', 'span', 'sub', 'sup', 'pre', 'code', 'blockquote'
]);

export function sanitizeHtml(html: string): string {
	let result = html;

	// Remove <script> tags and their content
	result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

	// Remove event handlers (onclick, onerror, etc.)
	result = result.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

	// Remove javascript: URLs from href
	result = result.replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"');
	result = result.replace(/href\s*=\s*javascript:[^\s>]+/gi, 'href="#"');

	// Remove disallowed tags but keep their content
	return result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tagName) => {
		const tag = tagName.toLowerCase();
		if (ALLOWED_TAGS.has(tag)) return match;
		// Strip tag but keep content
		return '';
	});
}
