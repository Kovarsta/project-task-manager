import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const p = new PrismaClient();
const tag = process.argv[2] ?? 'run';

const tables = await p.$queryRaw`
	SELECT relname AS "table",
	       seq_scan, idx_scan,
	       COALESCE(seq_scan::numeric / NULLIF(seq_scan + idx_scan, 0), 0) AS seq_ratio
	FROM pg_stat_user_tables
	WHERE relname IN ('Project', 'Task', 'ActivityLog', 'ProjectMember', 'User', 'TaskStatusHistory')
	ORDER BY relname`;

const totals = await p.$queryRaw`
	SELECT SUM(seq_scan)::bigint AS seq, SUM(idx_scan)::bigint AS idx
	FROM pg_stat_user_tables`;

const db = await p.$queryRaw`
	SELECT numbackends, xact_commit, xact_rollback, blks_read, blks_hit, deadlocks
	FROM pg_stat_database
	WHERE datname = 'projectmanager'`;

let redis = null;
try {
	const txt = execFileSync(
		'docker',
		['exec', 'vlu-task-management-redis-1', 'redis-cli', 'info', 'stats'],
		{ encoding: 'utf8' }
	);
	const line = (k) => {
		const m = txt.match(new RegExp(`^${k}:.*`, 'm'));
		return m ? m[0].split(':')[1] : null;
	};
	redis = {
		keyspace_hits: line('keyspace_hits'),
		keyspace_misses: line('keyspace_misses'),
		connected_clients: line('connected_clients')
	};
} catch (e) {
	redis = { error: e.message };
}

const out = { tag, capturedAt: new Date().toISOString(), tables, totals, db, redis };
const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results', `capture-${tag}.json`);
writeFileSync(outPath, JSON.stringify(out, (k, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
console.log(`Captured -> ${outPath}`);

await p.$disconnect();
