# API Reference

**30 endpoints** across **20 route paths**.

---

## Projects

### `GET /api/projects`
List the current user's projects in two groups: "my projects" (created by user) and "shared projects" (member only). Supports `?page=`, `?limit=`, `?q=` (fuzzy search on name, tags, description, deadline).

### `POST /api/projects`
Create a project. Required: `name` (max 50). Optional: `description` (sanitized HTML, max 60 plaintext chars), `deadline`, `tags` (max 10, each max 30).

---

## Project Detail

### `GET /api/projects/[id]`
Get a project by ID. Requires membership. Includes members with user data and non-done task count.

### `PATCH /api/projects/[id]`
Update a project. Requires admin. Fields: `name`, `status`, `description`, `deadline`, `tags`.

### `DELETE /api/projects/[id]`
Deactivate (soft delete) a project. Requires admin. Restores owner-only restriction. Sets `deactivatedAt` timestamp; super admins can reactivate.

---

## Tasks

### `GET /api/projects/[id]/tasks`
List tasks in a project. Supports `?q=` (title), `?status=`, `?priority=`, `?assignee=`, `?tag=`, `?sort=`/`?order=`, `?page=`, `?limit=`.

### `POST /api/projects/[id]/tasks`
Create a task. Requires admin. Required: `title` (max 100). Optional: `description` (sanitized HTML, max 2000), `tags` (max 10), `dueDate` (no past dates), `assigneeId`, `status`, `priority`.

### `GET /api/projects/[id]/tasks/[taskId]`
Get a task with assignee and creator info. Requires membership.

### `PATCH /api/projects/[id]/tasks/[taskId]`
Update a task. Fields: `title`, `description`, `tags`, `status`, `priority`, `dueDate`, `assigneeId`. Admin required to reassign. Automatically sets `startedAt`/`completedAt` on status changes. Records status change history.

### `DELETE /api/projects/[id]/tasks/[taskId]`
Delete a task. Requires admin.

---

## Members

### `GET /api/projects/[id]/members`
List project members with user data, ordered by join date, each with assigned task count. Supports `?page=`, `?limit=`, `?q=` (name/email search), `?role=` (`ADMIN`/`MEMBER`). Returns `memberCount` and `adminCount` in meta for stats.

### `GET /api/projects/[id]/members/[userId]`
Search users to invite. Accepts `?q=` (min 2 chars), returns up to 5 active matching users.

### `PATCH /api/projects/[id]/members/[userId]`
Change a member's role (`ADMIN`/`MEMBER`). Requires admin. Cannot change the owner's role. Admins can only demote themselves - demoting another admin returns `403`.

### `DELETE /api/projects/[id]/members/[userId]`
Remove a member. Requires admin. Cannot remove owner, last admin, or yourself (use `/leave`).

---

## Invites

### `GET /api/projects/[id]/invites`
List all invites for a project. Requires admin.

### `POST /api/projects/[id]/invites`
Generate an invite link. Requires admin. Accepts `email` (validated, optional domain restriction). Rejects duplicate pending invites for the same email. Creates a 7-day-expiring invite and sends an email. Logs activity.

### `DELETE /api/projects/[id]/invites/[inviteId]`
Revoke a pending invite. Requires admin.

---

## Project Actions

### `POST /api/projects/[id]/leave`
Leave a project. Owner cannot leave. Last admin cannot leave. Retains your task assignments (assignee name stays visible).

### `POST /api/projects/[id]/transfer-owner`
Transfer ownership to another member. Requires current owner. Accepts `userId`.

---

## Dashboard / Board

### `GET /api/projects/[id]/summary`
Dashboard summary for a project. Returns total tasks/members, 7-day completion stats, counts by status, overdue count, top urgent tasks, recent activity (last 5), and chart data.

### `GET /api/projects/[id]/kanban`
Tasks grouped by status (`TODO`/`DOING`/`DONE`) for a kanban board. Each group ordered by creation date.

### `GET /api/projects/[id]/activity`
Paginated activity log for a project. Supports `?page=`, `?limit=`. Returns actions (task create/complete/update/delete, member join/remove, role changes, invites) with user and timestamp. Includes `meta.total` for pagination.

---

## User Search

### `GET /api/users/search`
Search active users by name or email. Requires auth. Accepts `?q=` (min 2 chars), returns up to 5 users.

---

## Invite Acceptance

### `GET /api/invites/[token]`
Validate an invite token. No auth. Returns project name, invited email, expiry, and whether the project is deactivated.

### `POST /api/invites/[token]`
Accept an invite. Requires auth. Checks email match, creates membership, marks invite as `ACCEPTED`.

### `POST /api/invites/[token]/accept`
Alternate accept path. Same as `POST /api/invites/[token]` but also logs `member_joined` activity.

---

## Admin - Projects

### `GET /api/admin/projects`
List all projects (super admin). Supports `?page=`, `?limit=`, `?q=`.

### `PATCH /api/admin/projects/[id]`
Deactivate or reactivate a project. Accepts `{ action: "deactivate" | "reactivate" }`. Requires super admin.

---

## Admin - Users

### `GET /api/admin/users`
List all users (super admin). Supports `?page=`, `?limit=`, `?q=`.

### `PATCH /api/admin/users/[id]`
Update a user's super admin status or deactivate/reactivate them. Cannot demote self or last super admin. Cannot deactivate self.

---

**Total: 13 GET · 8 POST · 5 PATCH · 4 DELETE**
