import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireSuperAdmin } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { parseIdParam } from '$lib/server/helpers';

export async function PATCH(event: RequestEvent) {
	const caller = await requireSuperAdmin(event);
	const userId = parseIdParam(event.params.id, 'userId');

	if (isNaN(userId)) throw error(400, 'Invalid user ID');

	const body = await event.request.json();

	if (typeof body.isSuperAdmin === 'boolean') {
		if (caller.id === userId && body.isSuperAdmin === false) {
			throw error(400, 'You cannot demote yourself');
		}

		if (body.isSuperAdmin === false) {
			const superAdminCount = await prisma.user.count({
				where: { isSuperAdmin: true }
			});
			if (superAdminCount <= 1) {
				throw error(400, 'Cannot demote the last super admin');
			}
		}
	}

	if (body.deactivatedAt !== undefined) {
		if (caller.id === userId) {
			throw error(400, 'You cannot deactivate yourself');
		}
	}

	const data: Record<string, unknown> = {};
	if (typeof body.isSuperAdmin === 'boolean') {
		data.isSuperAdmin = body.isSuperAdmin;
	}
	if (body.deactivatedAt !== undefined) {
		data.deactivatedAt = body.deactivatedAt ? new Date() : null;
	}

	const user = await prisma.user.update({
		where: { id: userId },
		data,
		select: {
			id: true,
			name: true,
			email: true,
			isSuperAdmin: true,
			deactivatedAt: true,
			createdAt: true,
			_count: { select: { createdProjects: true, memberships: true, createdTasks: true } }
		}
	});

	return json(user);
}
