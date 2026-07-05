import { USE_MOCK_SSO } from '$env/static/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { useMockSSO: USE_MOCK_SSO === 'true' };
};
