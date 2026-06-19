import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireSuperAdmin } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

// PATCH: Promote / Demote to super admin
export async function PATCH(event: RequestEvent) {
	const caller = await requireSuperAdmin(event);
	const userId = Number(event.params.id);

	if (isNaN(userId)) throw error(400, 'Invalid user ID');

	const body = await event.request.json();

	if (typeof body.isSuperAdmin !== 'boolean') {
		throw error(400, 'isSuperAdmin must be a boolean');
	}

	// Cannot demote yourself
	if (caller.id === userId && body.isSuperAdmin === false) {
		throw error(400, 'You cannot demote yourself');
	}

	// Cannot demote if last super admin
	if (body.isSuperAdmin === false) {
		const superAdminCount = await prisma.user.count({
			where: { isSuperAdmin: true }
		});
		if (superAdminCount <= 1) {
			throw error(400, 'Cannot demote the last super admin');
		}
	}

	const user = await prisma.user.update({
		where: { id: userId },
		data: { isSuperAdmin: body.isSuperAdmin },
		select: {
			id: true,
			name: true,
			email: true,
			isSuperAdmin: true
		}
	});

	return json(user);
}
