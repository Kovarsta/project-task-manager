import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectMember } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { TaskStatus } from '@prisma/client';
import { parseIdParam } from '$lib/server/helpers';
import { taskSearchFilter } from '$lib/server/task-search';
import { cached } from '$lib/server/cache';

const PAGE_SIZE = 30;

const orderBy = [{ priority: 'desc' as const }, { dueDate: 'asc' as const }, { createdAt: 'asc' as const }, { id: 'asc' as const }];

const taskInclude = { assignee: { select: { id: true, name: true, email: true } } as const };

// GET: Return paginated tasks for one status (initial: returns all 3 columns in one query)
export async function GET(event: RequestEvent) {
	const projectId = parseIdParam(event.params.id, 'projectId');
	await requireProjectMember(event, projectId);

	const status = event.url.searchParams.get('status');
	const q = event.url.searchParams.get('q') || '';

	// Initial load — return first page of all 3 columns in one query
	if (!status) {
		const fetchAll = async () => {
			const tasks = await prisma.task.findMany({
				where: { projectId, ...(q && taskSearchFilter(q)) },
				include: taskInclude,
				orderBy,
				take: PAGE_SIZE * 3
			});

			const columns: Record<string, { tasks: typeof tasks; meta: { hasMore: boolean } }> = {
				TODO: { tasks: [], meta: { hasMore: false } },
				DOING: { tasks: [], meta: { hasMore: false } },
				DONE: { tasks: [], meta: { hasMore: false } }
			};

			for (const t of tasks) {
				if (columns[t.status]) columns[t.status].tasks.push(t);
			}

			for (const s of ['TODO', 'DOING', 'DONE'] as const) {
				columns[s].meta.hasMore = columns[s].tasks.length >= PAGE_SIZE;
			}

			return columns;
		};

		const columns = q ? await fetchAll() : await cached(`kanban:${projectId}:all:page:1`, 60, fetchAll);
		return json(columns);
	}

	// Lazy-load: single column, paginated
	const page = Math.max(1, Number(event.url.searchParams.get('page') ?? 1));
	const skip = (page - 1) * PAGE_SIZE;

	const shouldCache = page === 1 && !q;
	const key = `kanban:${projectId}:status:${status}:page:${page}`;

	const statusFilter =
		Object.values(TaskStatus).includes(status as TaskStatus)
			? (status as TaskStatus)
			: undefined;

	const where = {
		projectId,
		...(statusFilter && { status: statusFilter }),
		...(q && taskSearchFilter(q))
	};

	const fetchTasks = () =>
		Promise.all([
			prisma.task.findMany({ where, include: taskInclude, orderBy, skip, take: PAGE_SIZE }),
			prisma.task.count({ where })
		]);

	const [tasks, total] = shouldCache ? await cached(key, 60, fetchTasks) : await fetchTasks();

	return json({
		tasks,
		meta: { total, page, pageSize: PAGE_SIZE, hasMore: skip + PAGE_SIZE < total }
	});
}
