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

	return json({
		myProjects,
		sharedProjects,
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

