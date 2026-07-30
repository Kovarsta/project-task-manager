import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectMember, requireProjectAdmin } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';
import { sanitizeHtml } from '$lib/sanitize';
import type { RequestEvent } from '@sveltejs/kit';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { parseIdParam } from '$lib/server/helpers';
import { taskSearchFilter } from '$lib/server/task-search';
import { cached } from '$lib/server/cache';
import { getRedis } from '$lib/server/redis';

// GET: View all task
export async function GET(event: RequestEvent) {
	const projectId = parseIdParam(event.params.id, 'projectId');
	await requireProjectMember(event, projectId);

	const { searchParams } = event.url;
	const q = searchParams.get('q')?.trim();
	const status = searchParams.get('status');
	const priority = searchParams.get('priority');
	const assignee = searchParams.get('assignee');
	const tag = searchParams.get('tag')?.trim();
	const sortBy = searchParams.get('sort') ?? 'createdAt';
	const order = searchParams.get('order') ?? 'desc';
	const page = Math.max(1, Number(searchParams.get('page') ?? 1));
	const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)));
	const skip = (page - 1) * limit;

	const ALLOWED_SORTS = ['title', 'status', 'priority', 'dueDate', 'createdAt'];
	const sort = ALLOWED_SORTS.includes(sortBy) ? sortBy : 'createdAt';

	const statusEnum = Object.values(TaskStatus).includes(status as TaskStatus)
		? (status as TaskStatus)
		: undefined;
	const priorityEnum = Object.values(TaskPriority).includes(priority as TaskPriority)
		? (priority as TaskPriority)
		: undefined;

	const where = {
		projectId,
		...(statusEnum && { status: statusEnum }),
		...(priorityEnum && { priority: priorityEnum }),
		...(assignee && { assigneeId: Number(assignee) }),
		...(tag && { tags: { has: tag } }),
		...(q && taskSearchFilter(q))
	};

	const shouldCache = page === 1 && !q && !status && !priority && !assignee && !tag;
	const key = `tasks:${projectId}:page:${page}:limit:${limit}`;

	const fetchTasks = () =>
		Promise.all([
			prisma.task.findMany({
				where,
				include: {
					assignee: { select: { id: true, name: true, email: true } },
					createdBy: { select: { id: true, name: true } }
				},
				orderBy: [{ [sort]: order }, { id: 'asc' }],
				skip,
				take: limit
			}),
			prisma.task.count({ where })
		]);

	const [tasks, total] = shouldCache ? await cached(key, 15, fetchTasks) : await fetchTasks();

	return json({
		tasks,
		meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
	});
}

// POST: Create task
export async function POST(event: RequestEvent) {
	const projectId = parseIdParam(event.params.id, 'projectId');
	const user = await requireProjectAdmin(event, projectId);
	const body = await event.request.json();

	const title = body.title?.trim();
	if (!title) throw error(400, 'Title is required');
	if (title.length > 100) throw error(400, 'Title must be under 100 characters');

	const description = sanitizeHtml(body.description?.trim() ?? '') || null;
	if (description && description.length > 2000) {
		throw error(400, 'Description must be under 2000 characters');
	}

	// Validate tags
	const rawTags: string[] = Array.isArray(body.tags) ? body.tags : [];
	const tags = rawTags.map((t: string) => String(t).trim().toLowerCase()).filter(Boolean);
	if (tags.length > 10) throw error(400, 'Maximum 10 tags allowed');
	if (tags.some((t: string) => t.length > 30))
		throw error(400, 'Each tag must be under 30 characters');

	if (body.dueDate) {
		const dueDate = new Date(body.dueDate);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		if (dueDate < today) throw error(400, 'Due date cannot be in the past');
	}

	if (body.assigneeId) {
		const member = await prisma.projectMember.findUnique({
			where: {
				projectId_userId: { projectId, userId: Number(body.assigneeId) }
			}
		});
		if (!member) throw error(400, 'Assignee must be a project member');
	}

	const validStatuses = Object.values(TaskStatus) as string[];
	const validPriorities = Object.values(TaskPriority) as string[];
	const taskStatus = validStatuses.includes(body.status) ? body.status : 'TODO';
	const taskPriority = validPriorities.includes(body.priority) ? body.priority : 'MEDIUM';

	const task = await prisma.task.create({
		data: {
			projectId,
			title,
			description: description ?? null,
			tags,
			status: taskStatus,
			priority: taskPriority,
			assigneeId: body.assigneeId ? Number(body.assigneeId) : null,
			dueDate: body.dueDate ? new Date(body.dueDate) : null,
			createdById: user.id
		},
		include: {
			assignee: { select: { id: true, name: true, email: true } },
			createdBy: { select: { id: true, name: true } }
		}
	});

	await logActivity({
		projectId,
		userId: user.id,
		action: 'task_created',
		entityType: 'task',
		entityId: task.id,
		metadata: { title, status: task.status, assigneeId: task.assigneeId }
	});

	const redis = await getRedis();
	if (redis) {
		await redis.del(`tasks:${projectId}:page:1:limit:20`);
		await redis.del(`kanban:${projectId}:all:page:1`);
		for (const s of ['TODO', 'DOING', 'DONE']) {
			await redis.del(`kanban:${projectId}:status:${s}:page:1`);
		}
	}

	return json(task, { status: 201 });
}
