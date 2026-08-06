import http from 'k6/http';
import { check, sleep } from 'k6';
import { STAGES, BASE_URL, session } from './lib.js';

export const options = {
	stages: STAGES
};


const TERMS = ['Alice', 'Smith', 'user', 'Will', 'Demo', 'a', 'Jo', 'test'];

export default function () {
	const s = session(__VU);
	const term = TERMS[(__ITER + __VU) % TERMS.length];
	const r = http.get(`${BASE_URL}/api/users/search?q=${encodeURIComponent(term)}`, {
		headers: s.headers,
		tags: { endpoint: 'GET /api/users/search' }
	});
	check(r, { 'search 200': (x) => x.status === 200 });
	sleep(0.5);
}


