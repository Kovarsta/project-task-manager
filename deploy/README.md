# Deployment — task.kovarsta.com

Exposes the homelab app through a public Lightsail server. The homelab stays
behind NAT; only the Lightsail box needs inbound ports open.

## Topology

```
Internet
   │  https://task.kovarsta.com:443
   ▼
Lightsail (public)                 Homelab (NAT, no inbound ports)
┌─────────────────────┐            ┌──────────────────────────────┐
│ Caddy                │            │ rathole client               │
│  :443 (TLS, LE cert) │            │  connects out to :2333       │
│    └─► 127.0.0.1:8080│            │  └─► 127.0.0.1:3000 (app)    │
│ rathole server       │            └──────────────────────────────┘
│  :2333  control      │
│  :8080  exposed HTTP │
└─────────────────────┘
```

- Caddy terminates TLS and reverse-proxies to rathole's exposed port `8080`.
- rathole server listens for the client on `2333` and re-exposes the forwarded
  service on `8080`.
- `8080` is a **loopback-only** listener: Caddy and rathole run on the same box,
  so nothing inbound needs to reach `8080` from outside.
- rathole client (homelab) dials out to `tunnel.kovarsta.com:2333` and forwards
  traffic to the local app on `3000`.

## Lightsail setup

Only **two** inbound ports are required:

1. Open inbound ports in the firewall:
   - `443/tcp` (HTTPS) for Caddy
   - `2333/tcp` for the rathole control channel (or restrict to your ISP IP)
2. Install Caddy and rathole, then:

```bash
cp deploy/Caddyfile          /etc/caddy/Caddyfile
# replace ${RATHOLE_TOKEN} with your token first
envsubst < deploy/rathole-server.toml > /etc/rathole/server.toml
systemctl enable --now caddy
systemctl enable --now rathole   # systemd unit: rathole /etc/rathole/server.toml
```

Or skip bare-metal installs and run both as a compose bundle instead:

```bash
# The rathole token lives in deploy/.env (gitignored, not committed)
cp .env.example deploy/.env   # then set RATHOLE_TOKEN in deploy/.env
docker compose -f deploy/docker-compose.server.yml up -d
```

The bundle uses host networking so the same `Caddyfile` and
`rathole-server.toml` apply unchanged; Caddy's certs persist in the
`caddy-data` volume.

3. Point `task.kovarsta.com` (A/AAAA) at the Lightsail IP. Caddy
   auto-provisions the Let's Encrypt certificate.

### Cloudflare DNS (if the domain is behind Cloudflare)

Cloudflare only proxies HTTP/HTTPS (ports 80/443). rathole's control channel on
`2333` and its exposed port `8080` are raw TCP, so they must use **grey-cloud
(DNS-only)** records. Create two A records for the Lightsail IP:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `task`   | Lightsail IP | Proxied (orange) — web app |
| A | `tunnel` | Lightsail IP | DNS only (grey) — rathole :2333 |

`task` (orange) proxies HTTP/HTTPS through Cloudflare to Caddy on `443`.
`tunnel` (grey) is DNS-only so the rathole control channel on `2333` — raw TCP,
not HTTP — can reach the box. Do not orange-cloud `tunnel`.

Caddy terminates TLS inside Lightsail; set Cloudflare SSL/TLS mode to
**Full (strict)** so Cloudflare→Caddy is also encrypted.

## Homelab setup

1. Run the app stack: `docker compose up -d` (app on `3000`, plus the `tunnel`
   rathole client which dials out to the Lightsail box).
2. Nothing else needed — the `tunnel` service mounts
   `deploy/rathole-client.toml` and reconnects automatically if the connection
   drops. Both the homelab `.env` and the Lightsail `.env` must define
   `RATHOLE_TOKEN` (see below).

## App environment

Set these when running `docker compose up` (via `env` or a `.env` that is
NOT the local dev one):

```env
ORIGIN=https://task.kovarsta.com
ADDRESS_HEADER=x-forwarded-for
XFF_DEPTH=1
```

- `ORIGIN` must be the public origin; SvelteKit rejects requests whose Origin
  does not match (CSRF protection). The compose default is `http://localhost:3000`.
- `ADDRESS_HEADER=x-forwarded-for` + `XFF_DEPTH=1` tells adapter-node to trust
  the `X-Forwarded-For` header that Caddy adds, so the rate limiter keys on the
  real client IP instead of the tunnel's local address. Only enable when the
  tunnel is in front (as it is here).

## Rotating the tunnel token

The token is **not** stored in the repo. The committed `deploy/*.toml` files are
templates containing `${RATHOLE_TOKEN}`; a wrapper image (see
`deploy/rathole/`) substitutes the value from the `RATHOLE_TOKEN` environment
variable at container start. Both sides read it from their own `.env`.

Generate a new one with:

```bash
openssl rand -base64 24
```

Update `RATHOLE_TOKEN` in **both** `.env` files (homelab and Lightsail), then
restart both sides:

```bash
# Lightsail
docker compose -f deploy/docker-compose.server.yml up -d --build rathole
# Homelab
docker compose up -d --build tunnel
```

The `${RATHOLE_TOKEN:?}` guard in both compose files fails fast if the variable
is missing.