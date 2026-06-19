import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectMember, requireProjectAdmin } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { TaskStatus, TaskPriority } from '@prisma/client';

// GET: View all task
export async function GET(event: RequestEvent) {
  const projectId = Number(event.params.id)
  await requireProjectMember(event, projectId)

  const { searchParams } = event.url
  const q        = searchParams.get('q')?.trim()
  const status   = searchParams.get('status')
  const priority = searchParams.get('priority')
  const assignee = searchParams.get('assignee')
  const sort     = searchParams.get('sort') ?? 'createdAt'
  const order    = searchParams.get('order') ?? 'desc'
  const page     = Number(searchParams.get('page')  ?? 1)
  const limit    = Number(searchParams.get('limit') ?? 20)
  const skip     = (page - 1) * limit

  const statusEnum   = Object.values(TaskStatus).includes(status as TaskStatus) ? status as TaskStatus : undefined
  const priorityEnum = Object.values(TaskPriority).includes(priority as TaskPriority) ? priority as TaskPriority : undefined

  const where = {
    projectId,
    ...(statusEnum   && { status:     statusEnum }),
    ...(priorityEnum && { priority:   priorityEnum }),
    ...(assignee     && { assigneeId: Number(assignee) }),
    ...(q && { title: { contains: q, mode: 'insensitive' as const } })
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        assignee:  { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } }
      },
      orderBy: { [sort]: order },
      skip, take: limit
    }),
    prisma.task.count({ where })
  ])

  return json({
    tasks,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
  })
}

// POST: Create task
export async function POST(event: RequestEvent) {
	const projectId = Number(event.params.id);
	const user = await requireProjectAdmin(event, projectId);
	const body = await event.request.json();

	const title = body.title?.trim();
	if (!title) throw error(400, 'Title is required');
	if (title.length > 100) throw error(400, 'Title must be under 100 characters');

	const description = body.description?.trim();
	if (description && description.length > 2000) {
		throw error(400, 'Description must be under 2000 characters');
	}

	if (body.dueDate && new Date(body.dueDate) < new Date()) {
		throw error(400, 'Due date cannot be in the past');
	}

	if (body.assigneeId) {
		const member = await prisma.projectMember.findUnique({
			where: {
				projectId_userId: { projectId, userId: Number(body.assigneeId) }
			}
		});
		if (!member) throw error(400, 'Assignee must be a project member');
	}

	const task = await prisma.task.create({
		data: {
			projectId,
			title,
			description: description ?? null,
			status: body.status ?? 'TODO',
			priority: body.priority ?? 'MEDIUM',
			assigneeId: body.assigneeId ? Number(body.assigneeId) : null,
			dueDate: body.dueDate ? new Date(body.dueDate) : null,
			createdById: user.id
		},
		include: {
			assignee: { select: { id: true, name: true, email: true } },
			createdBy: { select: { id: true, name: true } }
		}
	});

	return json(task, { status: 201 });
}
