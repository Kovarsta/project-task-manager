# Load Test Tooling

k6-based load testing for the app, run against a production build on localhost.
A summary of the results and the methodology is in
[`LOAD-TEST-REPORT.md`](../LOAD-TEST-REPORT.md) at the repo root.

## Layout

| File | Purpose |
|------|---------|
| `lib.js` | Shared k6 helpers: `STAGES` (VU ramp profile), `BASE_URL`, per-VU `X-Forwarded-For` spoofing, `session(vu)` (cookie + headers) |
| `browse.js` | SSR flow: home → project list → project page → summary → tasks (p1/p50) → kanban. 7 requests/iteration, ~0.5s think time |
| `search.js` | `GET /api/users/search?q=<term>` with rotating terms |
| `abuse.js` | 20 fixed XFF IPs, no think time, designed to trip the rate limiter |
| `mint-tokens.mjs` | Mints valid session JWEs for the fixed test emails (never committed) |
| `capture.mjs` | Snapshots Postgres `pg_stat_*` + Redis `INFO stats` before/after a run |
| `summarize.mjs` | Streams k6 NDJSON → `results/<scenario>-<runId>.summary.json` (avg, p50/p90/p95/p99, per-endpoint, status codes) |
| `run-loadtest.ps1` | Shared launcher: builds env, starts `node build`, runs k6 scenarios, captures stats |
| `run-baseline.ps1` | Wrapper → RunId `baseline`, port 3100 |
| `run-head-full.ps1` | Wrapper → RunId `head-full`, port 3000, Redis on, `RATE_LIMIT_MAX=20000` |
| `run-head-nocache.ps1` | Wrapper → RunId `head-nocache`, port 3001, Redis off, rate limiter disabled |

## Prerequisites

- `k6` (`winget install GrafanaLabs.k6`)
- Node 22+, `tsx`, a `pnpm build` output in `build/`
- The dockerized `redis` (cache/limiter) and `db` (seeded) containers running for
  the Redis-enabled legs

## Quick start

```powershell
pnpm build                      # compile the app to build/
& load-test\run-head-full.ps1   # Redis on, port 3000
```

Each launcher: stops the dockerized app (frees the port), kills leftover app
node processes, loads `.env`, starts `node build` on the target port, snapshots
DB/Redis stats, runs the scenarios, summarizes results, snapshots stats again,
and stops the app. Session tokens are minted automatically if
`load-test/tokens.js` is missing.

## Launcher parameters

`run-loadtest.ps1` parameters:

| Parameter | Meaning |
|-----------|---------|
| `-RunId` | Label for this run's artifacts and captures |
| `-Port` | Port to run the app on |
| `-BuildDir` | Where `build/` lives (defaults to repo root) |
| `-UseRedis` | Redis on (`REDIS_URL`, `REDIS_ENABLED=true`) |
| `-RedisUrl` | Redis URL (default `redis://localhost:6379`) |
| `-RateLimitMax` | `RATE_LIMIT_MAX` (default -1 = app default 100; 0 disables) |
| `-UseProxyHeader` | Set `ADDRESS_HEADER=x-forwarded-for` + `XFF_DEPTH=1` (see below) |
| `-Scenarios` | Scenario list (default `browse search abuse`) |

## Why `-UseProxyHeader`

All k6 VUs share the host's TCP socket (`127.0.0.1`), but the rate limiter keys
on the **real socket address** (`event.getClientAddress()`) — which is immune to
forged `x-forwarded-for` by default. To exercise per-IP rate limiting in a test,
the launcher must opt the app into trusting the header via adapter-node's
`ADDRESS_HEADER`/`XFF_DEPTH` env vars (read at startup). This is a **test-only
opt-in**; production deployments key on the socket unless they're behind a
trusted reverse proxy.

## Reading results

- `results/<scenario>-<runId>.summary.json` — the summary for each scenario.
- `results/capture-<runId>-pre/post.json` — DB + Redis stat snapshots; diff
  pre/post for run deltas (e.g. Redis hit ratio, seq scans).
- Raw NDJSON is deleted after summarizing (browse raws can be multi-GB);
  `app-*.log` and `tokens.js` are gitignored.

## Caveats

- Runs against a **local `node build`**, not the dockerized image, so the app
  env is set by the launcher, not compose.
- Localhost only — measures app + DB compute, not bandwidth.
- Caches are TTL-based, so scenarios within one run share warm caches.
- Run artifacts are committed with distinct `-RunId`s so historical runs stay
  comparable (nothing overwrites the previous run).
