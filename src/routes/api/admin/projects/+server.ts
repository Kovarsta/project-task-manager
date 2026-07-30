import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireSuperAdmin } from '$lib/server/auth';
import { projectSearchFilter } from '$lib/server/project-search';
import type { RequestEvent } from '@sveltejs/kit';

// GET: Fetch all projects
export async function GET(event: RequestEvent) {
	await requireSuperAdmin(event);

	const { searchParams } = event.url;
	const q = searchParams.get('q')?.trim();
	const page = Math.max(1, Number(searchParams.get('page') ?? 1));
	const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)));
	const sortBy = searchParams.get('sort') ?? 'name';
	const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc';
	const skip = (page - 1) * limit;

	const ALLOWED_SORTS: Record<string, any> = {
		name: [{ name: order }, { id: 'asc' }],
		created: [{ createdAt: order }, { id: 'asc' }]
	};

	const orderBy = ALLOWED_SORTS[sortBy] ?? ALLOWED_SORTS.name;

	const where = {
		...(q && projectSearchFilter(q))
	};

	const [projects, total] = await Promise.all([
		prisma.project.findMany({
			where,
			include: {
				createdBy: { select: { id: true, name: true, email: true } },
				_count: { select: { members: true, tasks: true } }
			},
			orderBy,
			skip,
			take: limit
		}),
		prisma.project.count({ where })
	]);

	return json({
		projects,
		meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
	});
}
