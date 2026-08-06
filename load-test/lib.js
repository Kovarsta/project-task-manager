import tokens from './tokens.js';

export const STAGES = [
	{ duration: '60s', target: 100 },
	{ duration: '60s', target: 100 },
	{ duration: '30s', target: 250 },
	{ duration: '30s', target: 250 },
	{ duration: '30s', target: 0 }
];

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export function xff(vu) {
	const n = vu - 1;
	return `10.0.${Math.floor(n / 250)}.${(n % 250) + 1}`;
}

export function session(vu) {
	const t = tokens[(vu - 1) % tokens.length];
	return {
		email: t.email,
		headers: {
			Cookie: `authjs.session-token=${t.token}`,
			'X-Forwarded-For': xff(vu)
		}
	};
}
