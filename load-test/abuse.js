import http from 'k6/http';
import { check } from 'k6';
import { STAGES, BASE_URL } from './lib.js';
import tokens from './tokens.js';

export const options = {
	stages: STAGES
};


const FIXED_XFF = Array.from({ length: 20 }, (_, i) => `172.16.0.${i + 1}`);

export default function () {
	const t = tokens[(__VU - 1) % tokens.length];
	const headers = {
		Cookie: `authjs.session-token=${t.token}`,
		'X-Forwarded-For': FIXED_XFF[(__VU - 1) % FIXED_XFF.length]
	};
	const r = http.get(`${BASE_URL}/api/projects?page=1&limit=20`, {
		headers,
		tags: { endpoint: 'GET /api/projects' }
	});
	check(r, {
		'200': (x) => x.status === 200,
		'not 429': (x) => x.status !== 429
	});
}


