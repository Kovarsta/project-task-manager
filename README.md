# VLU Task Management

A multi-project task management system with role based access control, Microsoft SSO integration, Kanban board, and real time invite system.

Built as an internship project for Van Lang University.

---

## Tech Stack

| Layer    | Technology                                                        |
| -------- | ----------------------------------------------------------------- |
| Frontend | SvelteKit 2, Svelte 5, TailwindCSS, shadcn-svelte                 |
| Backend  | SvelteKit API routes                                              |
| Database  | PostgreSQL (self-hosted) with pg_trgm full-text search indexes   |
| ORM       | Prisma 6                                                          |
| Cache     | Redis 7 (session cache, auth membership, project summary, task detail, kanban, dashboard, rate limiter) |
| Auth      | Auth.js (GitHub OAuth for dev, Microsoft Entra ID for production) |
| Email     | Resend                                                            |

---

## Features

- **Multi-project management** - create and manage multiple projects simultaneously
- **Project lifecycle** - projects can be active, on hold, canceled, or complete; admins can deactivate (soft delete) projects; super admins can reactivate them
- **Rich text descriptions** - TipTap editor with HTML rendering and server-side sanitization
- **Role-based access control** - Super Admin, Project Admin, and Member roles with distinct permissions; admins can only demote themselves
- **Kanban board** - drag and drop tasks across Todo / Doing / Done columns
- **Task management** - create, edit, assign, prioritize, and track tasks with due dates; deadlines show days remaining with color coding; server-side search across title, assignee, and tags with debounce
- **Activity log** - per-project activity timeline with pagination tracking task and member changes
- **Invite system** - invite members via shareable link with email notification, 7-day expiry, domain restriction, and duplicate detection
- **Members page** - paginated member list with server-side search and role filtering
- **Weekly statistics** - Chart.js donut chart showing tasks created vs completed in the last 7 days
- **Tags and deadlines** - tag projects and tasks with color-coded labels, set deadlines with color-coded due date display
- **Super Admin panel** - system-wide project and user management with pagination, search, and deactivation controls
- **Redis caching** - session cache, auth membership checks, project summary, task detail, kanban board (combined page 1 + per-column lazy pages), dashboard page 1, and whole-page SSR rendering (per-user, 30s TTL) are cached in Redis with TTL-based expiry and explicit invalidation on mutations; read-through `cached<T>()` helper with graceful fallback if Redis is unavailable
- **Redis rate limiter** - fixed-window (default 100 req / 60s per IP+UA) enforced via `INCR` + `EXPIRE`, shared across all workers; keys on the real TCP socket address (immune to spoofed `x-forwarded-for`), with optional `ADDRESS_HEADER`/`XFF_DEPTH` support for trusted reverse proxies; falls back to a size-capped in-memory map if Redis is down
- **Database optimization** - composite B-tree indexes on common query patterns (`projectId + status + createdAt`, `assigneeId + status + projectId`, `projectId + dueDate + status`); trigram GIN indexes for fast `ILIKE` text search on task titles and user names; deterministic pagination with `id` tiebreaker on all list endpoints
- **Pagination throughout** - all list endpoints support paginated responses with meta; deterministic ordering prevents duplicates across page boundaries
- **Microsoft SSO ready** - swap provider via environment variables, zero code changes required

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm
- PostgreSQL database (local or hosted)

### Installation

```bash
git clone https://github.com/kovarsta/vlu-task-management.git
cd vlu-task-management
pnpm install
npx prisma generate
```

### Environment Variables

Create a `.env` file at the project root:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname
DIRECT_URL=postgresql://user:password@host:5432/dbname

# Auth
AUTH_SECRET=generate-with-npx-auth-secret

# Mock SSO during dev, GitHub SSO instead of Microsoft
USE_MOCK_SSO=true
AUTH_URL=http://localhost:5173
AUTH_TRUST_HOST=true

# GitHub OAuth (development)
AUTH_GITHUB_ID=your-github-client-id
AUTH_GITHUB_SECRET=your-github-client-secret

# Microsoft Entra ID (production — leave blank during dev)
AUTH_MICROSOFT_ENTRA_ID_ID=
AUTH_MICROSOFT_ENTRA_ID_SECRET=
AUTH_MICROSOFT_ENTRA_ID_ISSUER=

# Email (Resend)
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM_ADDRESS=noreply@yourdomain.com

# Domain restriction for invites (e.g. vanlanguni.vn)
# Leave blank to allow any domain during development
ALLOWED_EMAIL_DOMAIN=
```

### Database Setup

```bash
npx prisma db push
```

### Development

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Switching to Microsoft SSO (Production Handoff)

This project uses GitHub OAuth during development. To switch to Microsoft Entra ID:

1. Register an application in [Azure Portal](https://portal.azure.com) , Microsoft Entra ID , App registrations
2. Set the redirect URI to: `https://your-domain.com/auth/callback/microsoft-entra-id`
3. Generate a client secret under Certificates & secrets
4. Fill in the three Microsoft env vars in `.env`:

```env
AUTH_MICROSOFT_ENTRA_ID_ID=your-client-id
AUTH_MICROSOFT_ENTRA_ID_SECRET=your-client-secret
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/your-tenant-id/v2.0
```

No code changes required - the provider is swapped entirely via environment configuration.

---

## Email Configuration (Production Handoff)

This project uses [Resend](https://resend.com) for transactional emails (invite notifications).

1. Create a free account at resend.com
2. Verify your domain at resend.com/domains (add DNS records provided by Resend)
3. Create an API key and update `.env`:

```env
RESEND_API_KEY=your-api-key
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
```

> **Note:** Without a verified domain, Resend sandbox mode only delivers to the account owner's email. Domain verification is required for sending to all users.

---

## Docker

```bash
docker compose up -d
```

This starts PostgreSQL, PgBouncer (connection pool), Redis (cache + rate limiter), and the app (port 3000). Add `--profile tools` for pgAdmin (port 8080). The app connects to Postgres through PgBouncer for efficient connection pooling under load. All config comes from your `.env` file or environment defaults.

When exposed to the internet (see `deploy/`), the `tunnel` service runs a rathole client that forwards the app to the public endpoint; set `ORIGIN=https://your-domain` and `ADDRESS_HEADER=x-forwarded-for`/`XFF_DEPTH=1` for the rate limiter to key on real client IPs.

---

## Load Testing

The k6-based load-testing toolkit — scenarios, launcher scripts, token minting, and result capture/summarization — is documented in [`load-test/README.md`](load-test/README.md). The methodology, three-leg baseline-vs-optimized results, and reproduction steps are in [`LOAD-TEST-REPORT.md`](LOAD-TEST-REPORT.md).

---

## Project Structure

```
src/
  lib/
    components/ui/    # Shared UI components (modals, cards, pagination)
    server/           # Server-only utilities (auth helpers, email, API fetch, project search)
    sanitize.ts       # HTML sanitizer for rich text descriptions
    prisma.ts         # Prisma client singleton
    types.ts          # Shared TypeScript types
  routes/
    (app)/            # Main app - requires authentication
      +layout.svelte  # Sidebar + navbar shell
      +page           # Project list
      projects/[id]/  # Project detail (Summary, List, Board, Activity, Admin tabs)
      admin/          # Super Admin panel
    (auth)/           # Public routes - no sidebar
      login/          # Login page
      invite/[token]/ # Invite accept page
    api/              # REST API endpoints
      projects/
      invites/       # Invite creation and acceptance
      admin/         # Super admin endpoints
      users/         # User search
  prisma/
    schema.prisma     # Database schema
```

---

## Known Limitations

- Email delivery in sandbox mode is restricted to the Resend account owner's email until a domain is verified

---

## API Reference

See [`src/routes/api/README.md`](src/routes/api/README.md) for a complete list of all REST endpoints.
