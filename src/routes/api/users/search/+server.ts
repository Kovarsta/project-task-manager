import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireAuth } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent) {
	await requireAuth(event);

	const q = event.url.searchParams.get('q')?.trim();
	if (!q || q.length < 2) return json([]);

	const users = await prisma.user.findMany({
		where: {
			OR: [
				{ name: { contains: q, mode: 'insensitive' } },
				{ email: { contains: q, mode: 'insensitive' } }
			]
		},
		select: { id: true, name: true, email: true },
		take: 5
	});

	return json(users);
}

