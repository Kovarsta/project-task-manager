import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireSuperAdmin } from '$lib/server/auth';
import { invalidateProjectCaches } from '$lib/server/invalidate';
import type { RequestEvent } from '@sveltejs/kit';
import { parseIdParam } from '$lib/server/helpers';

// PATCH: Deactivate or reactivate a project
export async function PATCH(event: RequestEvent) {
	await requireSuperAdmin(event);

	const projectId = parseIdParam(event.params.id, 'projectId');
	if (isNaN(projectId)) throw error(400, 'Invalid project ID');

	const body = await event.request.json();
	const action = body.action;

	if (action !== 'deactivate' && action !== 'reactivate') {
		throw error(400, 'Action must be "deactivate" or "reactivate"');
	}

	const project = await prisma.project.findUnique({
		where: { id: projectId }
	});

	if (!project) throw error(404, 'Project not found');

	const updated = await prisma.project.update({
		where: { id: projectId },
		data: { deactivatedAt: action === 'deactivate' ? new Date() : null }
	});

	await invalidateProjectCaches(projectId);

	return json(updated);
}
