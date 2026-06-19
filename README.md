# VLU Task Management

A multi-project task management system with role based access control, Microsoft SSO integration, Kanban board, and real time invite system.

Built as an internship project for Van Lang University.

---

## Tech Stack

| Layer    | Technology                                                        |
| -------- | ----------------------------------------------------------------- |
| Frontend | SvelteKit 2, Svelte 5, TailwindCSS, shadcn-svelte                 |
| Backend  | SvelteKit API routes                                              |
| Database | PostgreSQL (via Supabase or self-hosted)                          |
| ORM      | Prisma 6                                                          |
| Auth     | Auth.js (GitHub OAuth for dev, Microsoft Entra ID for production) |
| Email    | Resend                                                            |


---

## Features

- **Multi-project management** - create and manage multiple projects simultaneously
- **Role-based access control** - Super Admin, Project Admin, and Member roles with distinct permissions
- **Kanban board** - drag and drop tasks across Todo / Doing / Done columns
- **Task management** - create, edit, assign, prioritize, and track tasks with due dates
- **Invite system** - invite members via shareable link with email notification, 7-day expiry, and domain restriction
- **Weekly statistics** - Chart.js donut chart showing tasks created vs completed in the last 7 days
- **Super Admin panel** - system wide project and user management
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
BETTER_AUTH_SECRET=auth-js-generated-secret

# Mock SSO during dev, GitHub SSO instead of Microsoft
USE_MOCK_SSO=true

# GitHub OAuth (development)
AUTH_GITHUB_ID=your-github-client-id
AUTH_GITHUB_SECRET=your-github-client-secret

# Microsoft Entra ID (production - leave blank during dev)
AUTH_MICROSOFT_ENTRA_ID_ID=
AUTH_MICROSOFT_ENTRA_ID_SECRET=
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=

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
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=your-tenant-id
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

## Setting the First Super Admin

Super Admin is assigned directly in the database - there is no UI promotion path for the initial Super Admin to prevent privilege escalation.

After at least one user has logged in:

```bash
npx prisma studio
```

Open the `User` table, find the target user, and set `isSuperAdmin` to `true`.

Subsequent Super Admins can be promoted via the Admin panel UI.

---

## Project Structure

```
src/
  lib/
    components/ui/    # Shared UI components (modals, cards, pagination)
    server/           # Server only utilities (auth helpers, email, API fetch)
    prisma.ts         # Prisma client singleton
    types.ts          # Shared TypeScript types
  routes/
    (app)/            # Main app - requires authentication
      +layout.svelte  # Sidebar + navbar shell
      +page           # Project list
      projects/[id]/  # Project detail (Summary, List, Board, Admin tabs)
      admin/          # Super Admin panel
    (auth)/           # Public routes - no sidebar
      login/          # Login page
      invite/[token]/ # Invite accept page
    api/              # REST API endpoints
      projects/
      invites/
      tasks/
      admin/
      users/
  prisma/
    schema.prisma     # Database schema
```


---

## Known Limitations

- Email delivery in sandbox mode is restricted to the Resend account owner's email until a domain is verified
- Search on paginated list views filters within the current page only, does not search across all pages
