import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireSuperAdmin } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

// GET: Show all users
export async function GET(event: RequestEvent) {
  await requireSuperAdmin(event)

  const { searchParams } = event.url
  const q     = searchParams.get('q')?.trim()
  const page  = Number(searchParams.get('page')  ?? 1)
  const limit = Number(searchParams.get('limit') ?? 20)
  const skip  = (page - 1) * limit

  const where = {
    ...(q && {
      OR: [
        { name:  { contains: q, mode: 'insensitive' as const } },
        { email: { contains: q, mode: 'insensitive' as const } }
      ]
    })
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, isSuperAdmin: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      skip, take: limit
    }),
    prisma.user.count({ where })
  ])

  return json({
    users,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
  })
}