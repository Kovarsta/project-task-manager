import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { useMockSSO: env.USE_MOCK_SSO === 'true' };
};
