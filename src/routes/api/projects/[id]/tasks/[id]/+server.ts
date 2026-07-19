import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectAdmin, requireProjectMember } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';
import { sanitizeHtml } from '$lib/sanitize';
import type { RequestEvent } from '@sveltejs/kit';
import { parseIdParam } from '$lib/server/helpers';
import { TaskStatus, TaskPriority } from '@prisma/client';

const taskInclude = {
	assignee: { select: { id: true, name: true, email: true } as const },
	createdBy: { select: { id: true, name: true } as const }
};

async function getTask(id: number) {
	const task = await prisma.task.findUnique({ where: { id }, include: taskInclude });
	if (!task) throw error(404, 'Task not found');
	return task;
}

// GET: View specific task
export async function GET(event: RequestEvent) {
	const taskId = parseIdParam(event.params.id, 'taskId');
	const task = await getTask(taskId);
	await requireProjectMember(event, task.projectId);
	return json(task);
}

// PATCH: Update specific task
export async function PATCH(event: RequestEvent) {
	const taskId = parseIdParam(event.params.id, 'taskId');
	const task = await getTask(taskId);
	const { user, member } = await requireProjectMember(event, task.projectId);
	const body = await event.request.json();
	const isAdmin = member.role === 'ADMIN';

	if (body.title !== undefined) {
		const title = body.title?.trim();
		if (!title) throw error(400, 'Title is required');
		if (title.length > 100) throw error(400, 'Title must be under 100 characters');
		body.title = title;
	}

	if (body.description !== undefined) {
		const desc = sanitizeHtml(body.description?.trim() ?? '') || null;
		if (desc && desc.length > 2000) {
			throw error(400, 'Description must be under 2000 characters');
		}
		body.description = desc;
	}

	if (body.tags !== undefined) {
		const rawTags: string[] = Array.isArray(body.tags) ? body.tags : [];
		const tags = rawTags.map((t: string) => String(t).trim().toLowerCase()).filter(Boolean);
		if (tags.length > 10) throw error(400, 'Maximum 10 tags allowed');
		if (tags.some((t: string) => t.length > 30))
			throw error(400, 'Each tag must be under 30 characters');
		body.tags = tags;
	}

	if (body.dueDate) {
		const dueDate = new Date(body.dueDate);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		if (dueDate < today) throw error(400, 'Due date cannot be in the past');
	}

	if (body.assigneeId !== undefined && !isAdmin) {
		throw error(403, 'Only admins can reassign tasks');
	}

	if (body.assigneeId) {
		const member = await prisma.projectMember.findUnique({
			where: {
				projectId_userId: {
					projectId: task.projectId,
					userId: Number(body.assigneeId)
				}
			}
		});
		if (!member) throw error(400, 'Assignee must be a project member');
	}

	const oldStatus = task.status;

	const validStatuses = Object.values(TaskStatus) as string[];
	const validPriorities = Object.values(TaskPriority) as string[];
	const rawStatus = body.status ?? oldStatus;
	const newStatus = validStatuses.includes(rawStatus) ? rawStatus : oldStatus;
	if (body.priority !== undefined && !validPriorities.includes(body.priority)) {
		throw error(400, `Invalid priority: must be one of ${validPriorities.join(', ')}`);
	}

	const updatedTask = await prisma.$transaction(async (tx) => {
		if (newStatus !== oldStatus) {
			await tx.taskStatusHistory.create({
				data: {
					taskId,
					changedById: user.id,
					fromStatus: oldStatus,
					toStatus: newStatus
				}
			});
		}

		return tx.task.update({
			where: { id: taskId },
			data: {
				...(body.title !== undefined && { title: body.title }),
				...(body.description !== undefined && { description: body.description }),
				...(body.tags !== undefined && { tags: body.tags }),
				...(body.status !== undefined && { status: newStatus }),
				...(body.priority !== undefined && { priority: body.priority }),
				...(body.dueDate !== undefined && {
					dueDate: body.dueDate ? new Date(body.dueDate) : null
				}),
				...(body.assigneeId !== undefined && {
					assigneeId: body.assigneeId ? Number(body.assigneeId) : null
				}),
				...(newStatus === 'DOING' && !task.startedAt && { startedAt: new Date() }),
				...(newStatus === 'DONE' && !task.completedAt && { completedAt: new Date() }),
				...(newStatus !== 'DONE' && task.completedAt && { completedAt: null })
			},
			include: taskInclude
		});
	});

	const action =
		newStatus !== oldStatus
			? newStatus === 'DONE'
				? 'task_completed'
				: newStatus === 'DOING'
					? 'task_started'
					: 'task_status_changed'
			: 'task_updated';

	await logActivity({
		projectId: task.projectId,
		userId: user.id,
		action,
		entityType: 'task',
		entityId: taskId,
		metadata: {
			title: updatedTask.title,
			oldStatus,
			newStatus,
			assigneeId: updatedTask.assigneeId,
			oldAssigneeId: task.assigneeId
		}
	});

	return json(updatedTask);
}

// DELETE: you already know
export async function DELETE(event: RequestEvent) {
	const taskId = parseIdParam(event.params.id, 'taskId');
	const task = await getTask(taskId);
	const user = await requireProjectAdmin(event, task.projectId);

	await prisma.task.delete({ where: { id: taskId } });

	await logActivity({
		projectId: task.projectId,
		userId: user.id,
		action: 'task_deleted',
		entityType: 'task',
		entityId: taskId,
		metadata: { title: task.title }
	});

	return json({ success: true });
}
