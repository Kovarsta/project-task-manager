import { prisma } from '$lib/prisma';

type LogInput = {
	projectId: number;
	userId: number;
	action: string;
	entityType?: string;
	entityId?: number;
	metadata?: Record<string, unknown>;
};

export async function logActivity(input: LogInput) {
	await prisma.activityLog.create({ data: input });
}
