import { json, error } from '@sveltejs/kit'
import { prisma } from '$lib/prisma'
import { requireProjectAdmin, requireProjectMember } from '$lib/server/auth'
import type { RequestEvent } from '@sveltejs/kit'

async function getTask(id: number) {
  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) throw error(404, 'Task not found')
  return task
}

// GET: View specific task 
export async function GET(event: RequestEvent) {
  const taskId = Number(event.params.id)
  const task   = await getTask(taskId)
  await requireProjectMember(event, task.projectId)

  const full = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee:  { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } }
    }
  })

  return json(full)
}

// PATCH: Update specific task 
export async function PATCH(event: RequestEvent) {
  const taskId          = Number(event.params.id)
  const task            = await getTask(taskId)
  const { user, member} = await requireProjectMember(event, task.projectId)
  const body            = await event.request.json()
  const isAdmin         = member.role === 'ADMIN'

  if (body.title !== undefined) {
    const title = body.title?.trim()
    if (!title)             throw error(400, 'Title is required')
    if (title.length > 100) throw error(400, 'Title must be under 100 characters')
    body.title = title
  }

  if (body.description !== undefined) {
    const desc = body.description?.trim()
    if (desc && desc.length > 2000) {
      throw error(400, 'Description must be under 2000 characters')
    }
    body.description = desc ?? null
  }

  if (body.dueDate && new Date(body.dueDate) < new Date()) {
    throw error(400, 'Due date cannot be in the past')
  }

  if (body.assigneeId !== undefined && !isAdmin) {
    throw error(403, 'Only admins can reassign tasks')
  }

  if (body.assigneeId) {
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: task.projectId,
          userId:    Number(body.assigneeId)
        }
      }
    })
    if (!member) throw error(400, 'Assignee must be a project member')
  }

  const oldStatus = task.status
  const newStatus = body.status ?? oldStatus

  const updatedTask = await prisma.$transaction(async (tx) => {
    if (newStatus !== oldStatus) {
      await tx.taskStatusHistory.create({
        data: {
          taskId,
          changedById: user.id,
          fromStatus:  oldStatus,
          toStatus:    newStatus,
        }
      })
    }

    return tx.task.update({
      where: { id: taskId },
      data: {
        ...(body.title       !== undefined && { title:       body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.status      !== undefined && { status:      body.status }),
        ...(body.priority    !== undefined && { priority:    body.priority }),
        ...(body.dueDate     !== undefined && { dueDate:     body.dueDate ? new Date(body.dueDate) : null }),
        ...(body.assigneeId  !== undefined && { assigneeId:  body.assigneeId ? Number(body.assigneeId) : null }),
        ...(newStatus === 'DOING' && !task.startedAt   && { startedAt:   new Date() }),
        ...(newStatus === 'DONE'  && !task.completedAt && { completedAt: new Date() }),
        ...(newStatus !== 'DONE'  && task.completedAt  && { completedAt: null }),
      },
      include: {
        assignee:  { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } }
      }
    })
  })

  return json(updatedTask)
}

// DELETE: you already know 
export async function DELETE(event: RequestEvent) {
  const taskId = Number(event.params.id)
  const task   = await getTask(taskId)
  await requireProjectAdmin(event, task.projectId)

  await prisma.task.delete({ where: { id: taskId } })

  return json({ success: true })
}