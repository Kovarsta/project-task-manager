import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectMember } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { TaskStatus } from '@prisma/client';
import { parseIdParam } from '$lib/server/helpers';

const PAGE_SIZE = 30;

// GET: Return paginated tasks for one status (or all if no status param)
export async function GET(event: RequestEvent) {
	const projectId = parseIdParam(event.params.id, 'projectId');
	await requireProjectMember(event, projectId);

	const status = event.url.searchParams.get('status');
	const page = Math.max(1, Number(event.url.searchParams.get('page') ?? 1));
	const q = event.url.searchParams.get('q') || '';
	const skip = (page - 1) * PAGE_SIZE;

	const statusFilter = status && Object.values(TaskStatus).includes(status as TaskStatus)
		? (status as TaskStatus)
		: undefined;

	const where: Record<string, unknown> = {
		projectId,
		...(statusFilter && { status: statusFilter })
	};

	if (q) {
		where.OR = [
			{ title: { contains: q, mode: 'insensitive' } },
			{ assignee: { name: { contains: q, mode: 'insensitive' } } }
		];
	}

	const [tasks, total] = await Promise.all([
		prisma.task.findMany({
			where,
			include: {
				assignee: { select: { id: true, name: true, email: true } }
			},
			orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
			skip,
			take: PAGE_SIZE
		}),
		prisma.task.count({ where })
	]);

	return json({
		tasks,
		meta: { total, page, pageSize: PAGE_SIZE, hasMore: skip + PAGE_SIZE < total }
	});
}
