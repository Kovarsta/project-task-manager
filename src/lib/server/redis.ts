import { createClient } from 'redis';

const url = process.env.REDIS_URL || 'redis://localhost:6379';

let client: ReturnType<typeof createClient> | null = null;
let connecting: Promise<void> | null = null;

export async function getRedis() {
	if (client?.isOpen) return client;

	if (!client) {
		client = createClient({ url });
		client.on('error', (err) => {
			console.error('Redis error:', err.message);
		});
	}

	if (!connecting) {
		connecting = client.connect().catch((err) => {
			console.error('Redis connection failed:', (err as Error).message);
			client = null;
			connecting = null;
		});
	}

	await connecting;
	return client?.isOpen ? client : null;
}
