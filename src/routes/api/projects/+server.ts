import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireAuth } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

// GET: View all projects
export async function GET(event: RequestEvent) {
	const user = await requireAuth(event);

	const page = Number(event.url.searchParams.get('page') ?? 1);
	const limit = Number(event.url.searchParams.get('limit') ?? 20);
	const skip = (page - 1) * limit;

	const [myProjects, myTotal] = await Promise.all([
		prisma.project.findMany({
			where: { createdById: user.id },
			include: { _count: { select: { tasks: { where: { status: { not: 'DONE' } } } } } },
			orderBy: { createdAt: 'desc' },
			skip,
			take: limit
		}),
		prisma.project.count({ where: { createdById: user.id } })
	]);

	const [sharedProjects, sharedTotal] = await Promise.all([
		prisma.project.findMany({
			where: { members: { some: { userId: user.id } }, NOT: { createdById: user.id } },
			include: { _count: { select: { tasks: { where: { status: { not: 'DONE' } } } } } },
			orderBy: { createdAt: 'desc' },
			skip,
			take: limit
		}),
		prisma.project.count({
			where: { members: { some: { userId: user.id } }, NOT: { createdById: user.id } }
		})
	]);

	// Augment each project with attention-sort data (tasks assigned to current user)
	const allProjectIds = [...myProjects, ...sharedProjects].map((p) => p.id);

	const assignedTasks = await prisma.task.findMany({
		where: {
			projectId: { in: allProjectIds },
			assigneeId: user.id,
			status: { not: 'DONE' }
		},
		select: { projectId: true, dueDate: true }
	});

	// Build lookup: projectId -> { count, earliestDue }
	const attentionMap = new Map<number, { count: number; earliestDue: string | null }>();
	for (const task of assignedTasks) {
		const existing = attentionMap.get(task.projectId) ?? { count: 0, earliestDue: null };
		const dueDateStr = task.dueDate ? task.dueDate.toISOString() : null;
		const earliestDue =
			existing.earliestDue === null
				? dueDateStr
				: dueDateStr === null
					? existing.earliestDue
					: dueDateStr < existing.earliestDue
						? dueDateStr
						: existing.earliestDue;
		attentionMap.set(task.projectId, { count: existing.count + 1, earliestDue });
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

	const project = await prisma.project.create({
		data: {
			name,
			createdById: user.id,
			members: {
				create: {
					userId: user.id,
					role: 'ADMIN'
				}
			}
		}
	});

	return json(project, { status: 201 });
}
