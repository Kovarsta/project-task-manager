import { createReadStream } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const [rawFile, runId] = process.argv.slice(2);
const scenario = path.basename(rawFile).replace(/\.raw\.json$/, '');

let start = Infinity;
let end = -Infinity;
const allDur = [];
const byEp = new Map();
const statusByEp = new Map();
let reqs = 0;
let errSamples = 0;
let errCount = 0;

const rl = readline.createInterface({ input: createReadStream(rawFile, { encoding: 'utf8' }) });

for await (const line of rl) {
	if (!line) continue;
	let p;
	try {
		p = JSON.parse(line);
	} catch {
		continue;
	}
	if (p.type !== 'Point') continue;

	const t = Date.parse(p.time ?? p.data?.time);
	if (t < start) start = t;
	if (t > end) end = t;

	const metric = p.metric;
	if (metric === 'http_req_duration') {
		const tags = p.tags ?? p.data?.tags;
		const ep = (tags && tags.endpoint) || 'unset';
		if (!byEp.has(ep)) {
			byEp.set(ep, []);
			statusByEp.set(ep, {});
		}
		byEp.get(ep).push(p.data.value);
		const st = (tags && tags.status) ?? '?';
		statusByEp.get(ep)[st] = (statusByEp.get(ep)[st] || 0) + 1;
		allDur.push(p.data.value);
	} else if (metric === 'http_reqs') {
		reqs += p.data.value;
	} else if (metric === 'http_req_failed') {
		errSamples++;
		if (p.data.value > 0) errCount++;
	}
}

const errorRate = errSamples ? errCount / errSamples : 0;
const durationMs = end - start;
const pct = (arr, q) => {
	if (!arr.length) return null;
	const s = [...arr].sort((a, b) => a - b);
	return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};
const durObj = (arr) => ({
	count: arr.length,
	avgMs: arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null,
	medMs: arr.length ? Math.round(pct(arr, 0.5) * 10) / 10 : null,
	p90Ms: arr.length ? Math.round(pct(arr, 0.9) * 10) / 10 : null,
	p95Ms: arr.length ? Math.round(pct(arr, 0.95) * 10) / 10 : null,
	p99Ms: arr.length ? Math.round(pct(arr, 0.99) * 10) / 10 : null
});

const endpoints = {};
for (const [ep, arr] of byEp) endpoints[ep] = { ...durObj(arr), statuses: statusByEp.get(ep) };

const summary = {
	scenario,
	runId,
	durationMs: Math.round(durationMs),
	requests: reqs || allDur.length,
	rps: Math.round((reqs / (durationMs / 1000)) * 10) / 10,
	errorRate: Math.round(errorRate * 10000) / 100,
	httpReqDuration: durObj(allDur),
	endpoints
};

const outPath = path.join(dir, 'results', `${scenario}-${runId}.summary.json`);
writeFileSync(outPath, JSON.stringify(summary, null, 2));
const d = summary.httpReqDuration;
console.log(
	`${scenario}-${runId}: rps=${summary.rps} p50=${d.medMs}ms p95=${d.p95Ms}ms p99=${d.p99Ms}ms err=${summary.errorRate}% reqs=${summary.requests}`
);
