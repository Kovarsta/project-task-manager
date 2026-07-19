import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';
import { requireProjectAdmin } from '$lib/server/auth';
import { logActivity } from '$lib/server/activity';
import type { RequestEvent } from '@sveltejs/kit';
import { sendInviteEmail } from '$lib/server/email';
import { parseIdParam } from '$lib/server/helpers';

// GET: All invites
export async function GET(event: RequestEvent) {
	const projectId = parseIdParam(event.params.id, 'projectId');
	await requireProjectAdmin(event, projectId);

	const page = Math.max(1, Number(event.url.searchParams.get('page') ?? 1));
	const limit = Math.min(50, Math.max(1, Number(event.url.searchParams.get('limit') ?? 20)));
	const skip = (page - 1) * limit;

	const [invites, total] = await Promise.all([
		prisma.projectInvite.findMany({
			where: { projectId },
			include: {
				invitedBy: { select: { id: true, name: true, email: true } }
			},
			orderBy: { createdAt: 'desc' },
			skip,
			take: limit
		}),
		prisma.projectInvite.count({ where: { projectId } })
	]);

	return json({ invites, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
}

// POST: Generate invitation
export async function POST(event: RequestEvent) {
	const projectId = parseIdParam(event.params.id, 'projectId');
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

	const existingInvite = await prisma.projectInvite.findFirst({
		where: {
			projectId,
			invitedEmail: email,
			status: 'PENDING',
			expiresAt: { gt: new Date() }
		}
	});

	if (existingInvite) {
		throw error(400, 'An invitation has already been sent to this email');
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

	await logActivity({
		projectId,
		userId: user.id,
		action: 'invite_sent',
		entityType: 'invite',
		entityId: invite.id,
		metadata: { email }
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
