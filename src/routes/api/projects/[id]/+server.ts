import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectAdmin, requireProjectMember } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

function getProjectId(event: RequestEvent) {
	const id = Number(event.params.id);
	if (isNaN(id)) throw error(400, 'Invalid project ID');
	return id;
}

// GET: Return a specific project data
export async function GET(event: RequestEvent) {
	const projectId = getProjectId(event);
	await requireProjectMember(event, projectId);

	const project = await prisma.project.findUnique({
		where: { id: projectId },
		include: {
			members: {
				include: { user: true }
			},
			_count: {
				select: {
					tasks: {
						where: { status: { not: 'DONE' } }
					}
				}
			}
		}
	});

	if (!project) throw error(404, 'Project not found');
	return json(project);
}

// PATCH: Update a project
export async function PATCH(event: RequestEvent) {
	const projectId = getProjectId(event);
	await requireProjectAdmin(event, projectId);

	const body = await event.request.json();
	const name = body.name?.trim();

	if (!name) throw error(400, 'Project name is required');
	if (name.length > 50) throw error(400, 'Project name must be under 50 characters');

	const project = await prisma.project.update({
		where: { id: projectId },
		data: { name }
	});

	return json(project);
}

// DELETE: duh
export async function DELETE(event: RequestEvent) {
	const projectId = getProjectId(event);
	await requireProjectAdmin(event, projectId);

	await prisma.project.delete({ where: { id: projectId } });

	return json({ success: true });
}
