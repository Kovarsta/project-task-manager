import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireAuth } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';
import { sanitizeHtml } from '$lib/sanitize';
import { projectSearchFilter } from '$lib/server/project-search';
import type { Prisma } from '@prisma/client';
import type { RequestEvent } from '@sveltejs/kit';
import { cached } from '$lib/server/cache';
import { invalidateDashboardCaches } from '$lib/server/invalidate';

// GET: View all projects
export async function GET(event: RequestEvent) {
	const user = await requireAuth(event);

	const page = Math.max(1, Number(event.url.searchParams.get('page') ?? 1));
	const limit = Math.min(50, Math.max(1, Number(event.url.searchParams.get('limit') ?? 20)));
	const skip = (page - 1) * limit;
	const q = event.url.searchParams.get('q') ?? '';
	const sortBy = event.url.searchParams.get('sort') ?? 'createdAt';
	const order = event.url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';

	const ALLOWED_SORTS: Record<string, Prisma.ProjectOrderByWithRelationInput[]> = {
		createdAt: [{ createdAt: order }, { id: 'asc' }],
		name: [{ name: order }, { id: 'asc' }],
		status: [{ status: order }, { id: 'asc' }],
		tasks: [{ tasks: { _count: order } }, { id: 'asc' }]
	};
	const orderBy = ALLOWED_SORTS[sortBy] ?? ALLOWED_SORTS.createdAt;

	const shouldCache = page === 1 && !q && sortBy === 'createdAt' && order === 'desc';
	const key = `dashboard:${user.id}:page:${page}:limit:${limit}:sort:${sortBy}:order:${order}`;

	function searchFilter(input: Prisma.ProjectWhereInput) {
		if (!q) return input;
		return { ...input, ...projectSearchFilter(q) };
	}

	const myWhere = searchFilter({
		createdById: user.id,
		members: { some: { userId: user.id } },
		deactivatedAt: null
	});
	const sharedWhere = searchFilter({
		members: { some: { userId: user.id } },
		NOT: { createdById: user.id },
		deactivatedAt: null
	});

	const fetchProjects = async () => {
		const [myProjects, myTotal, sharedProjects, sharedTotal] = await Promise.all([
			prisma.project.findMany({
				where: myWhere,
				include: { _count: { select: { tasks: { where: { status: { not: 'DONE' } } } } } },
				orderBy,
				skip,
				take: limit
			}),
			prisma.project.count({ where: myWhere }),
			prisma.project.findMany({
				where: sharedWhere,
				include: { _count: { select: { tasks: { where: { status: { not: 'DONE' } } } } } },
				orderBy,
				skip,
				take: limit
			}),
			prisma.project.count({ where: sharedWhere })
		]);

		// Aggregate attention data: count of assigned tasks + earliest due per project
		const allProjectIds = [...myProjects, ...sharedProjects].map((p) => p.id);
		const attentionAgg =
			allProjectIds.length > 0
				? await prisma.task.groupBy({
						by: ['projectId'],
						where: {
							projectId: { in: allProjectIds },
							assigneeId: user.id,
							status: { not: 'DONE' }
						},
						_count: { projectId: true },
						_min: { dueDate: true }
					})
				: [];

		return { myProjects, myTotal, sharedProjects, sharedTotal, attentionAgg };
	};

	const { myProjects, myTotal, sharedProjects, sharedTotal, attentionAgg } = shouldCache
		? await cached(key, 60, fetchProjects)
		: await fetchProjects();

	// Build lookup: projectId -> { count, earliestDue }
	const attentionMap = new Map<number, { count: number; earliestDue: string | null }>();
	for (const row of attentionAgg) {
		attentionMap.set(row.projectId, {
			count: row._count.projectId,
			earliestDue: row._min.dueDate ? row._min.dueDate.toISOString() : null
		});
	}

	function augment(projects: typeof myProjects) {
		return projects.map((p) => ({
			...p,
			_myTaskCount: attentionMap.get(p.id)?.count ?? 0,
			_earliestDue: attentionMap.get(p.id)?.earliestDue ?? null
		}));
	}

	return json({
		myProjects: augment(myProjects),
		sharedProjects: augment(sharedProjects),
		meta: {
			myTotal,
			sharedTotal,
			page,
			limit,
			myTotalPages: Math.ceil(myTotal / limit),
			sharedTotalPages: Math.ceil(sharedTotal / limit)
		}
	});
}

// POST: Create a new project
export async function POST(event: RequestEvent) {
	const user = await requireAuth(event);
	const body = await event.request.json();

	// *Reminder: Consider a stricter security practice
	const name = body.name?.trim();
	if (!name) throw error(400, 'Project name is required');
	if (name.length > 50) throw error(400, 'Project name must be under 50 characters');

	const rawDesc = body.description?.trim() || null;
	const description = rawDesc ? sanitizeHtml(rawDesc) : null;
	if (description) {
		const charCount = description.replace(/<[^>]*>/g, '').trim().length;
		if (charCount > 60) throw error(400, 'Description must be under 60 characters');
	}
	const deadline = body.deadline ? new Date(body.deadline) : null;

	const rawTags: string[] = Array.isArray(body.tags) ? body.tags : [];
	const tags = rawTags.map((t: string) => String(t).trim().toLowerCase()).filter(Boolean);
	if (tags.length > 10) throw error(400, 'Maximum 10 tags allowed');
	if (tags.some((t: string) => t.length > 30))
		throw error(400, 'Each tag must be under 30 characters');

	const project = await prisma.project.create({
		data: {
			name,
			description,
			deadline,
			tags,
			createdById: user.id,
			members: {
				create: {
					userId: user.id,
					role: 'ADMIN',
					isOwner: true
				}
			}
		}
	});

	await logActivity({
		projectId: project.id,
		userId: user.id,
		action: 'project_created',
		entityType: 'project',
		entityId: project.id,
		metadata: { name }
	});

	await invalidateDashboardCaches(user.id);

	return json(project, { status: 201 });
}
