import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- Deterministic PRNG so re-seeds are reproducible ---
function mulberry32(seed: number) {
	return function () {
		let t = (seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const rng = mulberry32(2026);
const rand = () => rng();

function randomItem<T>(arr: T[]): T {
	return arr[Math.floor(rand() * arr.length)];
}
function randomInt(min: number, max: number): number {
	return Math.floor(rand() * (max - min + 1)) + min;
}
function futureDate(daysFromNow: number): Date {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + daysFromNow);
	d.setUTCHours(0, 0, 0, 0);
	return d;
}
function pastDate(daysAgo: number): Date {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - daysAgo);
	d.setUTCHours(0, 0, 0, 0);
	return d;
}

const tagPool = [
	'bug',
	'feature',
	'docs',
	'design',
	'backend',
	'frontend',
	'urgent',
	'low-priority',
	'refactor',
	'testing',
	'devops',
	'security',
	'performance',
	'ux',
	'api',
	'database',
	'ui',
	'mobile',
	'desktop',
	'integration'
];

const titlePrefixes = [
	'Add',
	'Fix',
	'Update',
	'Remove',
	'Refactor',
	'Implement',
	'Optimize',
	'Migrate',
	'Redesign',
	'Extract',
	'Replace',
	'Consolidate'
];

const titleNouns = [
	'user auth flow',
	'dashboard layout',
	'API endpoint',
	'database schema',
	'notification system',
	'search feature',
	'export function',
	'import pipeline',
	'error handling',
	'form validation',
	'table component',
	'chart widget',
	'modal dialog',
	'dropdown menu',
	'sidebar nav',
	'footer section',
	'login page',
	'settings panel',
	'profile editor',
	'permission check',
	'rate limiter',
	'caching layer',
	'logging service',
	'health check',
	'batch processor',
	'scheduler',
	'file uploader',
	'image optimizer',
	'PDF generator',
	'email template',
	'CSV parser',
	'JSON validator'
];

const descriptionTemplates = [
	'Implement the {noun} with proper error handling and loading states.',
	'Refactor the {noun} to use the new pattern. The current implementation has performance issues.',
	'Fix the bug in {noun} where it crashes on empty input.',
	'Update the {noun} to support the new design spec.',
	'Add unit tests and integration tests for {noun}.',
	'Optimize the {noun} to handle larger datasets without timeout.',
	'Extract the {noun} into a reusable module shared across the app.',
	'Redesign the {noun} to match the latest mockups from Figma.',
	'Migrate the {noun} from REST to GraphQL.',
	'Remove deprecated code from {noun} and update callers.'
];

const statuses = ['TODO', 'DOING', 'DONE'] as const;
const priorities = ['LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST'] as const;
const actions = [
	'task_created',
	'task_status_changed',
	'task_completed',
	'task_updated',
	'member_added'
];

// --- Config ---
const PROJECT_NAME = 'Mega Project';
const TASKS = 35000;
const TASK_BATCH = 2000;
const MEMBERS = 1000;
const ACTIVITY_COUNT = 20000;
const ACTIVITY_BATCH = 5000;

function buildTaskData(projectId: number, i: number, memberPool: number[], ownerId: number) {
	const status = statuses[i % 3];
	const noun = randomItem(titleNouns);
	const prefix = randomItem(titlePrefixes);

	const tags: string[] = [];
	const tagCount = randomInt(0, 3);
	for (let t = 0; t < tagCount; t++) {
		const tag = randomItem(tagPool);
		if (!tags.includes(tag)) tags.push(tag);
	}

	const daysFromNow = randomInt(-10, 30);
	const dueDate =
		rand() < 0.1 ? null : daysFromNow < 0 ? pastDate(-daysFromNow) : futureDate(daysFromNow);

	return {
		projectId,
		title: `${prefix} ${noun}`,
		description: i % 4 === 0 ? null : randomItem(descriptionTemplates).replace('{noun}', noun),
		tags,
		status,
		priority: randomItem([...priorities]),
		assigneeId: randomItem(memberPool),
		createdById: ownerId,
		dueDate,
		createdAt: pastDate(randomInt(1, 30)),
		...(status === 'DOING' ? { startedAt: pastDate(randomInt(1, 10)) } : {}),
		...(status === 'DONE'
			? { startedAt: pastDate(randomInt(10, 20)), completedAt: pastDate(randomInt(1, 5)) }
			: {})
	};
}

async function main() {
	const userEmail = process.env.SEED_USER_EMAIL;
	if (!userEmail) {
		console.error('SEED_USER_EMAIL env var is required. Set it in .env or pass it inline.');
		process.exit(1);
	}

	console.log('Looking up your user...');
	const owner = await prisma.user.findUnique({ where: { email: userEmail } });
	if (!owner) {
		console.error(
			`User with email "${userEmail}" not found. Log in first via GitHub OAuth, then re-run.`
		);
		process.exit(1);
	}
	console.log(`Found user: ${owner.name} (${owner.email}), id=${owner.id}`);

	const existing = await prisma.project.findFirst({
		where: { name: PROJECT_NAME, createdById: owner.id }
	});
	if (existing) {
		console.error(
			`Project "${PROJECT_NAME}" already exists (id=${existing.id}). Delete it first, or this script will create a duplicate.`
		);
		process.exit(1);
	}

	console.log('Fetching fake users for membership...');
	const fakeUsers = await prisma.user.findMany({
		where: { microsoftId: { startsWith: 'seed-' } },
		select: { id: true },
		take: MEMBERS,
		orderBy: { id: 'asc' }
	});
	if (fakeUsers.length === 0) {
		console.error('No fake users found. Run `npx prisma db seed` first.');
		process.exit(1);
	}
	const memberIds = fakeUsers.map((u) => u.id);
	const memberPool = [...memberIds.slice(0, 20), owner.id];
	console.log(`Using ${memberIds.length} fake users as members.`);

	console.log(`Creating project "${PROJECT_NAME}"...`);
	const project = await prisma.project.create({
		data: {
			name: PROJECT_NAME,
			description: 'A large demo project seeded to showcase the application at scale.',
			status: 'ACTIVE',
			tags: ['mega', 'demo', 'seed'],
			deadline: futureDate(45),
			createdById: owner.id,
			members: {
				create: [
					{ userId: owner.id, role: 'ADMIN', isOwner: true },
					...memberIds.map((id) => ({ userId: id, role: 'MEMBER' as const }))
				]
			}
		}
	});
	console.log(`  Project id=${project.id}, ${memberIds.length + 1} members.`);

	console.log(`Creating ${TASKS} tasks (batching)...`);
	let total = 0;
	for (let i = 0; i < TASKS; i += TASK_BATCH) {
		const batch = Array.from({ length: Math.min(TASK_BATCH, TASKS - i) }, (_, j) =>
			buildTaskData(project.id, i + j, memberPool, owner.id)
		);
		await prisma.task.createMany({ data: batch });
		total += batch.length;
		if (total % 10000 === 0) console.log(`  ... ${total} / ${TASKS} tasks`);
	}
	const actual = await prisma.task.count({ where: { projectId: project.id } });
	console.log(`  Created ${actual} tasks.`);

	console.log('Creating status history...');
	const doneTasks = await prisma.task.findMany({
		where: { projectId: project.id, status: { in: ['DOING', 'DONE'] } },
		select: { id: true, status: true, createdById: true }
	});
	const historyRows = doneTasks.flatMap((t) => {
		const changedById = t.createdById;
		if (t.status === 'DOING') {
			return [
				{
					taskId: t.id,
					changedById,
					fromStatus: 'TODO' as const,
					toStatus: 'DOING' as const,
					changedAt: pastDate(randomInt(1, 10))
				}
			];
		}
		return [
			{
				taskId: t.id,
				changedById,
				fromStatus: 'TODO' as const,
				toStatus: 'DOING' as const,
				changedAt: pastDate(randomInt(10, 20))
			},
			{
				taskId: t.id,
				changedById,
				fromStatus: 'DOING' as const,
				toStatus: 'DONE' as const,
				changedAt: pastDate(randomInt(1, 5))
			}
		];
	});
	for (let i = 0; i < historyRows.length; i += TASK_BATCH) {
		await prisma.taskStatusHistory.createMany({ data: historyRows.slice(i, i + TASK_BATCH) });
	}
	console.log(`  Created ${historyRows.length} status history entries.`);

	console.log(`Creating ${ACTIVITY_COUNT} activity logs...`);
	const activityUsers = [...memberIds.slice(0, 50), owner.id];
	for (let i = 0; i < ACTIVITY_COUNT; i += ACTIVITY_BATCH) {
		const batch = Array.from({ length: Math.min(ACTIVITY_BATCH, ACTIVITY_COUNT - i) }, () => ({
			projectId: project.id,
			userId: activityUsers[Math.floor(rand() * activityUsers.length)],
			action: randomItem(actions),
			entityType: 'task',
			entityId: null,
			createdAt: pastDate(randomInt(0, 30))
		}));
		await prisma.activityLog.createMany({ data: batch });
	}
	console.log(`  Created ${ACTIVITY_COUNT} activity logs.`);

	const [taskCount, memberCount] = await Promise.all([
		prisma.task.count({ where: { projectId: project.id } }),
		prisma.projectMember.count({ where: { projectId: project.id } })
	]);
	console.log('\n--- Mega project seed complete ---');
	console.log(`Project:      ${PROJECT_NAME} (id=${project.id})`);
	console.log(`Owner:        ${owner.name} (${owner.email})`);
	console.log(`Tasks:        ${taskCount}`);
	console.log(`Members:      ${memberCount}`);
}

main()
	.catch((e) => {
		console.error('Seed failed:', e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
