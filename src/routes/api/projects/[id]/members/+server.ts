import { json } from '@sveltejs/kit'
import { prisma } from '$lib/prisma'
import { requireProjectMember } from '$lib/server/auth'
import type { RequestEvent } from '@sveltejs/kit'

// GET: Return all users 
export async function GET(event: RequestEvent) {
  const projectId = Number(event.params.id)
  await requireProjectMember(event, projectId)

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: true },
    orderBy: { joinedAt: 'asc' }
  })

  return json(members)
}