import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { STAGES, BASE_URL, session } from './lib.js';

export const options = {
	stages: STAGES
};


const MEGA = [36, 37];

function projectFor(email) {
	if (email.includes('2000')) return 38;
	if (email.includes('2500')) return 39;
	return MEGA[__ITER % MEGA.length];
}

export default function () {
	const s = session(__VU);
	const p = projectFor(s.email);

	group('home', () => {
		const r = http.get(`${BASE_URL}/`, {
			headers: s.headers,
			tags: { endpoint: 'GET /' }
		});
		check(r, { 'home 200': (x) => x.status === 200 });
	});

	group('projects-list', () => {
		const r = http.get(`${BASE_URL}/api/projects?page=1&limit=20`, {
			headers: s.headers,
			tags: { endpoint: 'GET /api/projects' }
		});
		check(r, { 'projects 200': (x) => x.status === 200 });
	});

	group('project-page', () => {
		const r = http.get(`${BASE_URL}/projects/${p}`, {
			headers: s.headers,
			tags: { endpoint: 'GET /projects/[id]' }
		});
		check(r, { 'page 200': (x) => x.status === 200 });
	});

	group('summary', () => {
		const r = http.get(`${BASE_URL}/api/projects/${p}/summary`, {
			headers: s.headers,
			tags: { endpoint: 'GET /api/projects/[id]/summary' }
		});
		check(r, { 'summary 200': (x) => x.status === 200 });
	});

	group('tasks-p1', () => {
		const r = http.get(`${BASE_URL}/api/projects/${p}/tasks?page=1`, {
			headers: s.headers,
			tags: { endpoint: 'GET /api/projects/[id]/tasks?page=1' }
		});
		check(r, { 'tasks p1 200': (x) => x.status === 200 });
	});

	group('tasks-p50', () => {
		const r = http.get(`${BASE_URL}/api/projects/${p}/tasks?page=50`, {
			headers: s.headers,
			tags: { endpoint: 'GET /api/projects/[id]/tasks?page=50' }
		});
		check(r, { 'tasks p50 200': (x) => x.status === 200 });
	});

	group('kanban', () => {
		const r = http.get(`${BASE_URL}/api/projects/${p}/kanban`, {
			headers: s.headers,
			tags: { endpoint: 'GET /api/projects/[id]/kanban' }
		});
		check(r, { 'kanban 200': (x) => x.status === 200 });
	});

	sleep(0.5);
}


