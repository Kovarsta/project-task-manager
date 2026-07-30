import { getRedis } from './redis';

export async function cached<T>(key: string, ttlSeconds: number, fetch: () => Promise<T>): Promise<T> {
	const redis = await getRedis();

	if (redis) {
		try {
			const cached = await redis.get(key);
			if (cached) {
				return JSON.parse(cached) as T;
			}
		} catch {
			// Cache read failed, fall through to fetch
		}
	}

	const data = await fetch();

	if (redis) {
		try {
			await redis.setEx(key, ttlSeconds, JSON.stringify(data));
		} catch {
			// Cache write failed — data is already fetched, still return it
		}
	}

	return data;
}
