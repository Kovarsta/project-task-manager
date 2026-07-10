export type ActivityItem = {
	id: number;
	action: string;
	entityType: string | null;
	entityId: number | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
	user: { id: number; name: string };
};

export function describeActivity(log: ActivityItem) {
	switch (log.action) {
		case 'project_created':
			return 'created this project';
		case 'task_created':
			return `created task "${log.metadata?.title ?? ''}"`;
		case 'task_completed':
			return `completed task "${log.metadata?.title ?? ''}"`;
		case 'task_started':
			return `started task "${log.metadata?.title ?? ''}"`;
		case 'task_status_changed':
			return `moved task "${log.metadata?.title ?? ''}" from ${log.metadata?.oldStatus} to ${log.metadata?.newStatus}`;
		case 'task_updated':
			return `updated task "${log.metadata?.title ?? ''}"`;
		case 'task_deleted':
			return `deleted task "${log.metadata?.title ?? ''}"`;
		case 'member_role_changed':
			return `${log.metadata?.newRole === 'ADMIN' ? 'promoted' : 'demoted'} ${log.metadata?.name} to ${log.metadata?.newRole}`;
		case 'member_removed':
			return `removed ${log.metadata?.name} from the project`;
		case 'member_joined':
			return `${log.metadata?.name} joined the project`;
		case 'invite_sent':
			return `invited ${log.metadata?.email}`;
		default:
			return log.action;
	}
}

export function timeAgo(dateStr: string) {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
