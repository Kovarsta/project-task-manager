import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectMember } from '$lib/server/auth';
import { parseIdParam } from '$lib/server/helpers';
import type { RequestEvent } from '@sveltejs/kit';

// GET: Return members with pagination and search
export async function GET(event: RequestEvent) {
	const projectId = parseIdParam(event.params.id, 'projectId');
	await requireProjectMember(event, projectId);

	const page = Math.max(1, Number(event.url.searchParams.get('page') ?? 1));
	const limit = Math.min(50, Math.max(1, Number(event.url.searchParams.get('limit') ?? 20)));
	const q = event.url.searchParams.get('q')?.trim() ?? '';
	const role = event.url.searchParams.get('role')?.trim() ?? '';

	const where: Record<string, unknown> = { projectId };
	const userWhere: Record<string, unknown> = {};
	if (q) {
		userWhere.OR = [
			{ name: { contains: q, mode: 'insensitive' } },
			{ email: { contains: q, mode: 'insensitive' } }
		];
		where.user = userWhere;
	}
	if (role === 'ADMIN' || role === 'MEMBER') {
		where.role = role;
	}

	const [members, total, memberCount, adminCount] = await Promise.all([
		prisma.projectMember.findMany({
			where,
			include: { user: { select: { id: true, name: true, email: true } } },
			orderBy: [{ isOwner: 'desc' }, { role: 'asc' }, { joinedAt: 'asc' }, { id: 'asc' }],
			skip: (page - 1) * limit,
			take: limit
		}),
		prisma.projectMember.count({ where }),
		prisma.projectMember.count({ where: { projectId } }),
		prisma.projectMember.count({
			where: { projectId, OR: [{ role: 'ADMIN' }, { isOwner: true }] }
		})
	]);

	const userIds = members.map((m) => m.userId);
	const taskCounts = await prisma.task.groupBy({
		by: ['assigneeId'],
		where: { projectId, assigneeId: { in: userIds } },
		_count: { id: true }
	});
	const countMap = new Map(taskCounts.map((t) => [t.assigneeId, t._count.id]));

	const result = members.map((m) => ({
		...m,
		_count: { tasks: countMap.get(m.userId) ?? 0 }
	}));

	return json({
		members: result,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
			memberCount,
			adminCount
		}
	});
}
