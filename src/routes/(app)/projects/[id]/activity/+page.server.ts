import type { PageServerLoad } from './$types';
import { serverFetch } from '$lib/server/api';

export const load: PageServerLoad = async (event) => {
	const page = Number(event.url.searchParams.get('page') ?? 1);
	const limit = Number(event.url.searchParams.get('limit') ?? 20);

	const res = await serverFetch(
		event,
		`/api/projects/${event.params.id}/activity?page=${page}&limit=${limit}`
	);

	return {
		logs: res.logs as Array<{
			id: number;
			action: string;
			entityType: string | null;
			entityId: number | null;
			metadata: Record<string, unknown> | null;
			createdAt: string;
			user: { id: number; name: string };
		}>,
		meta: res.meta as { page: number; limit: number; total: number; totalPages: number }
	};
};
