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

	const data: Record<string, unknown> = {};

	if (body.name !== undefined) {
		const name = String(body.name).trim();
		if (!name) throw error(400, 'Project name is required');
		if (name.length > 50) throw error(400, 'Project name must be under 50 characters');
		data.name = name;
	}

	if (body.status !== undefined) {
		const validStatuses = ['ACTIVE', 'ON_HOLD', 'CANCELED', 'COMPLETE'];
		if (!validStatuses.includes(body.status)) throw error(400, 'Invalid project status');
		data.status = body.status;
	}

	if (body.description !== undefined) {
		const desc = String(body.description).trim() || null;
		if (desc) {
			const wordCount = desc.replace(/<[^>]*>/g, '').trim().split(/\s+/).length;
			if (wordCount > 60) throw error(400, 'Description must be under 60 words');
		}
		data.description = desc;
	}

	if (body.deadline !== undefined) {
		data.deadline = body.deadline ? new Date(body.deadline) : null;
	}

	if (body.tags !== undefined) {
		const rawTags: string[] = Array.isArray(body.tags) ? body.tags : [];
		const tags = rawTags.map((t: string) => String(t).trim().toLowerCase()).filter(Boolean);
		if (tags.length > 10) throw error(400, 'Maximum 10 tags allowed');
		if (tags.some((t: string) => t.length > 30))
			throw error(400, 'Each tag must be under 30 characters');
		data.tags = tags;
	}

	if (Object.keys(data).length === 0) throw error(400, 'No fields to update');

	const project = await prisma.project.update({
		where: { id: projectId },
		data
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
