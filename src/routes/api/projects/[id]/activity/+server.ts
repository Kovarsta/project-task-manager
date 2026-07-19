import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectMember } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { parseIdParam } from '$lib/server/helpers';

// GET: Paginated activity log
export async function GET(event: RequestEvent) {
	const projectId = parseIdParam(event.params.id, 'projectId');
	await requireProjectMember(event, projectId);

	const page = Math.max(1, Number(event.url.searchParams.get('page') ?? 1));
	const limit = Math.min(50, Math.max(1, Number(event.url.searchParams.get('limit') ?? 20)));

	const [logs, total] = await Promise.all([
		prisma.activityLog.findMany({
			where: { projectId },
			include: { user: { select: { id: true, name: true } } },
			orderBy: { createdAt: 'desc' },
			skip: (page - 1) * limit,
			take: limit
		}),
		prisma.activityLog.count({ where: { projectId } })
	]);

	return json({
		logs,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		}
	});
}
