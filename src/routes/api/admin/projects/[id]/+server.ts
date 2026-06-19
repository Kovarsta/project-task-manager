import { json, error } from '@sveltejs/kit'
import { prisma } from '$lib/prisma'
import { requireSuperAdmin } from '$lib/server/auth'
import type { RequestEvent } from '@sveltejs/kit'

// DELETE: Delete a specific project 
export async function DELETE(event: RequestEvent) {
  await requireSuperAdmin(event)

  const projectId = Number(event.params.id)
  if (isNaN(projectId)) throw error(400, 'Invalid project ID')

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  })

  if (!project) throw error(404, 'Project not found')

  await prisma.project.delete({ where: { id: projectId } })

  return json({ success: true })
}