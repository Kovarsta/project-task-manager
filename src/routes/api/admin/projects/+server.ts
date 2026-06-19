import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireSuperAdmin } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

// GET: Fetch all projects
export async function GET(event: RequestEvent) {
	await requireSuperAdmin(event);

	const { searchParams } = event.url;
	const q = searchParams.get('q')?.trim();
	const page = Number(searchParams.get('page') ?? 1);
	const limit = Number(searchParams.get('limit') ?? 20);
	const skip = (page - 1) * limit;

	const where = {
		...(q && { name: { contains: q, mode: 'insensitive' as const } })
	};

	const [projects, total] = await Promise.all([
		prisma.project.findMany({
			where,
			include: {
				createdBy: { select: { id: true, name: true, email: true } },
				_count: { select: { members: true, tasks: true } }
			},
			orderBy: { createdAt: 'desc' },
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

