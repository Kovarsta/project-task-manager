import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectAdmin } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { sendInviteEmail } from '$lib/server/email';

// GET: All invites
export async function GET(event: RequestEvent) {
	const projectId = Number(event.params.id);
	await requireProjectAdmin(event, projectId);

	const invites = await prisma.projectInvite.findMany({
		where: {
			projectId
		},
		include: {
			invitedBy: { select: { id: true, name: true, email: true } }
		},
		orderBy: { createdAt: 'desc' }
	});

	return json(invites);
}

// POST: Generate invitation
export async function POST(event: RequestEvent) {
	const projectId = Number(event.params.id);
	const user = await requireProjectAdmin(event, projectId);
	const body = await event.request.json();

	// Validate email
	const email = body.email?.trim().toLowerCase();
	if (!email) throw error(400, 'Email is required');

	// Yes this is written with AI, i barely know regex
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email)) throw error(400, 'Invalid email format');

	// Check domain read from env, fallback to any domain during dev
	const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;

	if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
		throw error(400, `Email must belong to ${allowedDomain}`);
	}

	const existingMember = await prisma.user.findUnique({
		where: { email },
		include: {
			memberships: {
				where: { projectId }
			}
		}
	});

	if (existingMember?.memberships.length) {
		throw error(400, 'User is already a member of this project');
	}

	// Create invite, expires in 7 days
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 7);

	const invite = await prisma.projectInvite.create({
		data: {
			projectId,
			invitedById: user.id,
			invitedEmail: email,
			expiresAt
		}
	});

	// Return the full invite link
	const baseUrl = event.url.origin;

	// Sending email
	const project = await prisma.project.findUnique({ where: { id: projectId } });
	if (!project) throw error(404, 'Project not found');
	const link = `${baseUrl}/invite/${invite.token}`;
	await sendInviteEmail(email, project.name, link);

	return json(
		{
			...invite,
			link: `${baseUrl}/invite/${invite.token}`
		},
		{ status: 201 }
	);
}
