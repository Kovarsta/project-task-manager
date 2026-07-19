import { prisma } from '$lib/prisma';
import type { Prisma } from '@prisma/client';

type LogInput = {
	projectId: number;
	userId: number;
	action: string;
	entityType?: string;
	entityId?: number;
	metadata?: Record<string, unknown>;
};

export function logActivity(input: LogInput) {
	const data: Prisma.ActivityLogCreateInput = {
		project: { connect: { id: input.projectId } },
		user: { connect: { id: input.userId } },
		action: input.action,
		...(input.entityType && { entityType: input.entityType }),
		...(input.entityId && { entityId: input.entityId }),
		...(input.metadata && { metadata: input.metadata as Prisma.JsonObject })
	};

	prisma.activityLog.create({ data }).catch((e) => console.error('Failed to log activity:', e));
}
