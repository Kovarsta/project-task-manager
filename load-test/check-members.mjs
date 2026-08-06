import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
try {
	const rows = await p.$queryRaw`
		SELECT p.id, p.name, u.email
		FROM "ProjectMember" pm
		JOIN "Project" p ON p.id = pm."projectId"
		JOIN "User" u ON u.id = pm."userId"
		WHERE u.email IN ('user0@demo.local','user1000@demo.local','user2000@demo.local','user2500@demo.local','user1001@demo.local')
		AND p.id IN (36,37,38,39)
		ORDER BY p.id, u.email`;
	console.table(rows);
} finally {
	await p.$disconnect();
}
