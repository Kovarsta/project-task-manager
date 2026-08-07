# Load Test Report — vlu-task-management

Date: 2026-08-06 · Machine: local dev (Windows, single host) · Seed: ~172k tasks, ~3k users, mega-projects 36–38, ~3k memberships

## Verdict

The optimization work delivers net benefit. Under the same workload on the same
machine:

- **Baseline** (`a40561b`, pre-optimization) served **0 of 3** scenarios
  error-free: browse failed **82.4%**, abuse failed **99.0%**, search failed
  **10.7%**. The old app rate-limits real users into a 429 wall and throws 500s
  on its SSR pages under load.
- **HEAD** (`f134d40`, full stack) served **all 3 scenarios with 0% errors** at
  the same 250-VU peak.
- **Redis alone** is worth ~2x browse throughput, ~6x abuse throughput, and
  12.7x fewer full-table scans.
- **SSR page caching** (added after the ladder) takes browse from p99 1,734ms →
  425ms while serving **2.2x more requests** at 0% errors — see
  [Comparison 3](#comparison-3--head-full--head-full--page-cache).

## Methodology

3-run ladder, identical k6 scenarios and seed on each run. Same machine,
localhost only — this measures app + DB compute, not bandwidth.

| Run | Build | Config | Port |
|-----|-------|--------|------|
| 1. Baseline | `a40561b` (parent of first perf commit) | direct DB, no Redis, hardcoded rate limit 100 req/60s/IP | 3100 |
| 2. HEAD full | `f134d40` | Redis on, `RATE_LIMIT_MAX=20000` | 3000 |
| 3. HEAD no-cache | `f134d40` (same build) | Redis off (`REDIS_ENABLED=false`), `RATE_LIMIT_MAX=0` | 3001 |

Workload (per scenario): 60s ramp 0→100 VUs, 60s hold at 100, 30s ramp→250,
30s hold at 250, 30s ramp→0. Per-VU `X-Forwarded-For` IPs keep rate-limit
buckets distinct.

- `browse` — SSR flow: home → project list → project page → summary → tasks
  (p1/p50) → kanban. 7 requests per iteration, ~0.5s think time.
- `search` — `GET /api/users/search?q=<term>`, rotating terms, ~0.5s think time.
- `abuse` — 20 fixed IPs, no think time, single endpoint, designed to trip the
  rate limiter.

## Result matrix

| Run | Scenario | Requests | RPS | Error % | p50 | p95 | p99 |
|-----|----------|---------:|----:|--------:|----:|----:|----:|
| Baseline | browse | 156,597 | 748 | **82.42** | 4.6ms | 763ms | 1,195ms |
| Baseline | search | 49,496 | 236 | **10.68** | 10.2ms | 49ms | 89ms |
| Baseline | abuse | 812,400 | 3,870 | **99.03** | 16.6ms | 50ms | 142ms |
| HEAD full | browse | 56,280 | 269 | **0.00** | 271ms | 1,229ms | 1,734ms |
| HEAD full | search | 48,972 | 233 | **0.00** | 10.7ms | 72ms | 176ms |
| HEAD full | abuse | 106,579 | 508 | **0.00** | 197ms | 449ms | 523ms |
| HEAD no-cache | browse | 28,259 | 135 | **0.00** | 635ms | 2,542ms | 3,548ms |
| HEAD no-cache | search | 48,453 | 231 | **0.00** | 14.6ms | 95ms | 184ms |
| HEAD no-cache | abuse | 18,022 | 86 | **0.00** | 1,113ms | 3,094ms | 3,308ms |
| HEAD full + page cache | browse | 122,101 | 583 | **0.00** | 94.5ms | 327ms | 425ms |
| HEAD full + page cache | search | 49,361 | 235 | **0.00** | 9.3ms | 55ms | 159ms |
| HEAD full + page cache | abuse | 117,315 | 559 | **0.00** | 172ms | 429ms | 492ms |

Baseline p50 latency is computed over its mostly-rejected traffic (see caveats);
it is not comparable to HEAD's "every request actually served" latency.

## Comparison 1 — Baseline → HEAD full (total net benefit)

The baseline's errors are not random flakiness; they are the app's own
protections failing under load:

- **browse (82.4% errors)**: 118,262 of 156,597 requests returned **429** — the
  hardcoded in-memory limiter (100 req/60s per IP) throttles a user doing 7
  page views per ~1.2s iteration. A further **10,813 returned 500** — the SSR
  pages crash when load does get through.
- **abuse (99.0% errors)**: 804,546 of 812,400 requests returned 429. A fixed
  pool of 20 IPs × 250 VUs exhausts the limit bucket in seconds and stays
  exhausted — the limiter is the bottleneck, not the app.
- **search (10.7% errors)**: pure 429s from the same limiter (single call per
  ~0.5s iteration exceeds 100/min).

HEAD at the same load: **0% errors everywhere**. Three things changed:

1. The rate limiter is configurable (`RATE_LIMIT_MAX`, Phase 1 commit `4b64093`),
   removing the 429 wall for legitimate load.
2. The Redis caching layer absorbs repeated queries (session, project lists,
   summaries, tasks, kanban) — 99.7% hit ratio, see telemetry.
3. The earlier perf passes (compression, over-fetch fixes, select-over-include,
   indexes) keep each request cheap enough to survive 250 VUs without 500s.

### HEAD full — where the time goes (browse, all requests 200)

| Endpoint | p50 | p95 |
|----------|----:|----:|
| SSR: home `/` | 467ms | 1,351ms |
| SSR: project page `/projects/[id]` | 646ms | 1,800ms |
| API: project list `/api/projects` | 208ms | 594ms |
| API: tasks p1 / p50 | 183 / 212ms | 565 / 584ms |
| API: kanban | 192ms | 560ms |

The SSR pages dominate. These render HTML server-side and re-fetch their data
in the same request; at 250 VUs the single Node process's event loop is the
bottleneck, and the heavier SSR work queues up API calls behind it. The API
endpoints are all in the same ~180–210ms band for the same reason (queueing
behind SSR work), not because they individually cost 200ms.

## Comparison 2 — HEAD full → HEAD no-cache (Redis marginal value)

The no-cache leg is byte-identical to HEAD full except Redis is off and the
rate limiter is disabled. This isolates what the Redis layer contributes:

| Metric | browse | abuse |
|--------|-------:|------:|
| Throughput with Redis | 269 rps | 508 rps |
| Throughput without | 135 rps | 86 rps |
| **Throughput gain** | **2.0x** | **5.9x** |
| p50 latency with | 271ms | 197ms |
| p50 latency without | 635ms | 1,113ms |

- search is unaffected (a single lightweight query per iteration; the session
  cache is the only Redis touch and it is small) — 233 vs 231 rps, p50 10.7 vs
  14.6ms.
- The DB does **12.7x more full-table scans without Redis**: 146,928 seq scans
  vs 11,612 (see telemetry). Redis turns repeated identical queries into memory
  hits instead of planner full scans.

## Comparison 3 — HEAD full → HEAD full + page cache

*Addendum (2026-08-07). Not part of the original 3-run ladder; same build and
config as HEAD full, plus the `pageCache` hook.*

The `pageCache` hook (`src/hooks.server.ts`) caches the **whole SSR document**
per user + URL in Redis with a 30s TTL, slotted into the hooks sequence between
`authGuard` and `compressAndCache`. On a hit the request never reaches
`resolve()`; `/api` paths are skipped (they already have data-level caching).
Only effective when Redis is on, so the no-cache leg is unaffected.

### Browse

| Metric | HEAD full | HEAD full + page cache | Change |
|--------|----------:|-----------------------:|-------:|
| Throughput | 269 rps | 583 rps | **2.2x** |
| p50 | 271ms | 94.5ms | 2.9x faster |
| p95 | 1,229ms | 327ms | 3.8x faster |
| p99 | 1,734ms | 425ms | **4.1x faster** |
| Requests served | 56,280 | 122,101 | 2.2x more |

This is the strong version of the result: the run served **2.2x more requests
in the same wall time** (faster iterations, not lighter load) at **4x lower
p99**. The SSR pages — the tail story from Comparison 1 — collapsed:

| Endpoint | p50 before → after | p95 before → after |
|----------|--------------------:|-------------------:|
| SSR: project page `/projects/[id]` | 646 → **82ms** | 1,800 → **298ms** |
| SSR: home `/` | 467 → **86ms** | 1,351 → **305ms** |
| API: summary | 191 → 88ms | 566 → 316ms |
| API: tasks p1 | 183 → 89ms | 565 → 314ms |

The APIs improved too even though `/api` is not page-cached: freeing the
render CPU (and its event-loop queueing) sped up the API calls that share the
process. The residual ~700ms p99 on the SSR pages is the periodic 30s TTL
re-render miss + brotli compression still queueing under the 250-VU herd —
the next knobs are a longer TTL and cheaper compression.

### Search & abuse (regression check)

search is API-only and unaffected: 233 → 235 rps, p99 176 → 159ms. abuse is
API-only: 508 → 559 rps, 0% errors. No regression on the non-SSR paths.

## Telemetry

| Metric | Baseline | HEAD full | HEAD no-cache |
|--------|----------|-----------|---------------|
| Redis key hits during run | n/a (no Redis) | 481,682 | 0 |
| Redis key misses during run | n/a | 1,414 | 0 |
| **Redis hit ratio** | — | **99.7%** | — |
| DB seq scans during run | n/a | 11,612 | 146,928 |
| DB blks_read (post) | — | 1,017 | 1,017 |
| DB numbackends (post) | — | 14 | — |
| DB rollbacks / deadlocks | — | 0 / 0 | 0 / 0 |

`blks_read` unchanged at 1,017 across runs: the working set fits in Postgres
shared buffers after warmup, so no run is disk-bound.

## Caveats (read these before quoting numbers)

- **Same machine, localhost.** There is no network hop, so the test measures
  app + DB compute only. Bandwidth-driven optimizations (brotli compression of
  every response) show up here as pure CPU cost on HEAD, inflating HEAD
  latency relative to what it would do on a real network.
- **Baseline p50 is over rejected traffic.** 75–99% of baseline requests were
  429s (fast rejections). Its "4.6ms p50" does not mean the baseline is fast; it
  means the baseline refused the load.
- **The browse pace is aggressive.** 7 requests per ~1.2s per VU exceeds the
  baseline's 100 req/min/IP cap by design — the 429 wall is baseline behavior,
  and making the limiter configurable was itself part of the optimization
  (`4b64093`).
- **Single Node process.** HEAD latency at 250 VUs is dominated by event-loop
  saturation (SSR rendering + compression + JWT decrypt), not by the Redis/DB
  work it replaced. Clustering the process would be the next lever; it is out
  of scope here.
- **Deltas include minor fix commits.** Baseline→HEAD is the full `a40561b →
  f134d40` range (`9da0bdb` perf #1, `1f06ee4`, `f868847`, `c012a7a`, `19e3456`
  perf #2, `6f058b2`, `4b64093`, `f134d40`), not just the caching work.
- **One run was discarded as invalid.** The first no-cache attempt pointed
  `REDIS_URL` at a dead port; node-redis's default reconnect strategy retries
  forever, so every request hung ~30s and the "result" was a config bug, not
  the app. Fixed in `src/lib/server/redis.ts` (`REDIS_ENABLED` toggle +
  `connectTimeout: 1000` + `reconnectStrategy: () => false`) and re-run. That
  fix is itself a production robustness win: a Redis outage no longer hangs
  requests.
- **The page-cache run is an addendum, not a ladder leg.** It shares HEAD full's
  config but adds the `pageCache` hook, so its numbers are not directly in the
  Baseline→HEAD causal chain — treat them as "same workload, plus SSR page
  caching." Its artifacts are saved under `head-full-pagecache` (no original
  files were overwritten).

## Reproduce

```powershell
# baseline worktree already built at ../vlu-task-management-baseline
& load-test\run-baseline.ps1     # port 3100
& load-test\run-head-full.ps1    # port 3000 (Redis on, RATE_LIMIT_MAX=20000)
& load-test\run-head-nocache.ps1 # port 3001 (Redis off, RATE_LIMIT_MAX=0)
# addendum: SSR page-cache leg (run-loadtest.ps1 directly so artifacts get a
# distinct runId instead of overwriting head-full)
& load-test\run-loadtest.ps1 -RunId head-full-pagecache -Port 3000 -BuildDir <root> -UseRedis -RateLimitMax 20000 -UseProxyHeader
```

Each launcher: stops the dockerized app, kills leftover app node processes,
waits for readiness, snapshots Postgres + Redis stats, runs `browse`/`search`/
`abuse` via k6, summarizes the NDJSON stream, snapshots stats again.

Artifacts in `load-test/results/`: per-scenario `*.summary.json` and
`capture-*.json` (Postgres `pg_stat_*` + Redis `INFO stats`). Raw NDJSON is
deleted after summarizing (baseline raws were multi-GB).

## What each layer proved

| Layer | Proof |
|-------|-------|
| Rate limiter config + stability | Baseline 82–99% errors (429 + 500) → HEAD 0% |
| Redis cache | Run 2 vs 3: 2.0x browse / 5.9x abuse throughput; 99.7% hit ratio; 12.7x fewer seq scans |
| DB indexes / query fixes | No 500s under 250 VUs; zero deadlocks/rollbacks; working set stays in buffers |
| Compression + session cache (perf #1) | Inside the Baseline→HEAD total; costs CPU locally but pays bandwidth on a real network |
| SSR page cache (per-user HTML, 30s TTL) | Run 2 vs 4: 2.2x browse throughput; p99 1,734→425ms; SSR page p50s 646→82ms / 467→86ms |
