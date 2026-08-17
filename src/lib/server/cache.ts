import { getRedis } from './redis';

const DATE_KEY = '__vluDate__';

// JSON.stringify calls Date.prototype.toJSON() BEFORE the replacer runs, so a
// replacer never sees a Date — it only sees the already-serialized ISO string.
// Walk the value first and tag Dates explicitly.
function tagDates(value: unknown): unknown {
	if (value instanceof Date) {
		return { [DATE_KEY]: value.toISOString() };
	}
	if (Array.isArray(value)) {
		return value.map(tagDates);
	}
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
			out[key] = tagDates(val);
		}
		return out;
	}
	return value;
}

function reviver(_key: string, value: unknown): unknown {
	if (value && typeof value === 'object' && DATE_KEY in (value as Record<string, unknown>)) {
		const iso = (value as Record<string, unknown>)[DATE_KEY];
		if (typeof iso === 'string') return new Date(iso);
	}
	return value;
}

export async function cached<T>(key: string, ttlSeconds: number, fetch: () => Promise<T>): Promise<T> {
	const redis = await getRedis();

	if (redis) {
		try {
			const cachedValue = await redis.get(key);
			if (cachedValue) {
				return JSON.parse(cachedValue, reviver) as T;
			}
		} catch {
			// Cache read failed, fall through to fetch
		}
	}

	const data = await fetch();

	if (redis) {
		try {
			await redis.setEx(key, ttlSeconds, JSON.stringify(tagDates(data)));
		} catch {
			// Cache write failed — data is already fetched, still return it
		}
	}

	return data;
}
