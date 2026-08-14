import { getRedis } from './redis';

const KANBAN_STATUSES = ['TODO', 'DOING', 'DONE'] as const;

function kanbanKeys(projectId: number): string[] {
	return [
		`kanban:${projectId}:all:page:1`,
		...KANBAN_STATUSES.map((s) => `kanban:${projectId}:status:${s}:page:1`)
	];
}

function taskListKeys(projectId: number): string[] {
	// Only the default variant (page 1) is eagerly invalidated; other
	// pages/limits self-heal via their bounded TTL.
	return [`tasks:${projectId}:page:1:limit:20`, `tasks:${projectId}:page:1:limit:50`];
}

function dashboardKeys(userId: number): string[] {
	return [`dashboard:${userId}:page:1:limit:20`, `dashboard:${userId}:page:1:limit:50`];
}

async function del(keys: string[]): Promise<void> {
	if (keys.length === 0) return;
	const redis = await getRedis();
	if (!redis) return;
	try {
		await redis.del(keys);
	} catch {
		// invalidation failure is not fatal — caches are TTL-bounded
	}
}

/** A task was created/updated/deleted — drop all project-scoped caches. */
export function invalidateProjectCaches(projectId: number): Promise<void> {
	return del([`project:summary:${projectId}`, ...taskListKeys(projectId), ...kanbanKeys(projectId)]);
}

/** Task-level caches plus the lists/board/summary they appear in. */
export function invalidateTaskCaches(projectId: number, taskId: number): Promise<void> {
	return del([`task:${taskId}`, `project:summary:${projectId}`, ...taskListKeys(projectId), ...kanbanKeys(projectId)]);
}

/** Membership changed (joined/left/removed/role/owner) for a user. */
export function invalidateMembershipCaches(projectId: number, userId: number): Promise<void> {
	return del([`auth:member:${userId}:${projectId}`, `project:summary:${projectId}`, ...dashboardKeys(userId)]);
}

/** A user's project list changed (created/deactivated a project they own). */
export function invalidateDashboardCaches(userId: number): Promise<void> {
	return del(dashboardKeys(userId));
}

/** Admin demoted/deactivated a user — refresh their session-cached claims. */
export function invalidateUserCaches(email: string): Promise<void> {
	return del([`auth:session:${email}`, `auth:user:${email}`]);
}
