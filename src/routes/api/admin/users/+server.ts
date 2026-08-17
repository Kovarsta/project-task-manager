import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireSuperAdmin } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

// GET: Show all users
export async function GET(event: RequestEvent) {
	await requireSuperAdmin(event);

	const { searchParams } = event.url;
	const q = searchParams.get('q')?.trim();
	const role = searchParams.get('role');
	const page = Math.max(1, Number(searchParams.get('page') ?? 1));
	const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)));
	const sortBy = searchParams.get('sort') ?? 'name';
	const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc';
	const skip = (page - 1) * limit;

	const ALLOWED_SORTS: Record<string, any> = {
		name: [{ name: order }, { id: 'asc' }],
		role: [{ isSuperAdmin: order === 'asc' ? 'desc' : 'asc' }, { id: 'asc' }],
		status: [{ deactivatedAt: order === 'desc' ? 'asc' : 'desc' }, { id: 'asc' }],
		created: [{ createdAt: order }, { id: 'asc' }]
	};

	const orderBy = ALLOWED_SORTS[sortBy] ?? ALLOWED_SORTS.name;

	const where = {
		...(q && {
			OR: [
				{ name: { contains: q, mode: 'insensitive' as const } },
				{ email: { contains: q, mode: 'insensitive' as const } },
				// status keywords: "active" / "deactivated"
				...(q.match(/^(active|enabled|online)$/i)
					? [{ deactivatedAt: null as null }]
					: []),
				...(q.match(/^(deact(ivated)?|disabled|inactive|banned|suspended)$/i)
					? [{ deactivatedAt: { not: null as null } }]
					: []),
				// role keywords: "super admin" / "regular"
				...(q.match(/^(super ?admin|admin|super)$/i)
					? [{ isSuperAdmin: true as boolean }]
					: []),
				...(q.match(/^(regular|user|member|normal)$/i)
					? [{ isSuperAdmin: false as boolean }]
					: [])
			]
		}),
		...(role === 'super' && { isSuperAdmin: true }),
		...(role === 'user' && { isSuperAdmin: false })
	};

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where,
			select: {
				id: true,
				name: true,
				email: true,
				isSuperAdmin: true,
				deactivatedAt: true,
				createdAt: true,
				_count: { select: { createdProjects: true, memberships: true, createdTasks: true } }
			},
			orderBy,
			skip,
			take: limit
		}),
		prisma.user.count({ where })
	]);

	return json({
		users,
		meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
	});
}
