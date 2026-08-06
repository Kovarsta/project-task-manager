import 'dotenv/config';
import { PrismaClient, TaskStatus } from '@prisma/client';

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
const rng = mulberry32(1337);
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

const firstNames = [
	'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry',
	'Ivy', 'Jack', 'Kara', 'Leo', 'Mona', 'Nate', 'Olivia', 'Paul',
	'Quinn', 'Rita', 'Sam', 'Tina', 'Uma', 'Vince', 'Wendy', 'Xander',
	'Yara', 'Zack', 'Abby', 'Ben', 'Clara', 'Dan', 'Ella', 'Finn',
	'Gina', 'Hank', 'Iris', 'Jake', 'Kai', 'Liam', 'Maya', 'Noah',
	'Piper', 'Rex', 'Sage', 'Theo', 'Vera', 'Will', 'Zara', 'Aria',
	'Blake', 'Cora', 'Drew', 'Eliza', 'Gabe', 'Holly', 'Jade', 'Kurt'
];

const lastNames = [
	'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
	'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
	'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
	'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
	'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
	'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green',
	'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
	'Carter', 'Roberts'
];

const tagPool = [
	'bug', 'feature', 'docs', 'design', 'backend', 'frontend',
	'urgent', 'low-priority', 'refactor', 'testing', 'devops',
	'security', 'performance', 'ux', 'api', 'database', 'ui',
	'mobile', 'desktop', 'integration'
];

const titlePrefixes = [
	'Add', 'Fix', 'Update', 'Remove', 'Refactor', 'Implement',
	'Optimize', 'Migrate', 'Redesign', 'Extract', 'Replace', 'Consolidate'
];

const titleNouns = [
	'user auth flow', 'dashboard layout', 'API endpoint', 'database schema',
	'notification system', 'search feature', 'export function', 'import pipeline',
	'error handling', 'form validation', 'table component', 'chart widget',
	'modal dialog', 'dropdown menu', 'sidebar nav', 'footer section',
	'login page', 'settings panel', 'profile editor', 'permission check',
	'rate limiter', 'caching layer', 'logging service', 'health check',
	'batch processor', 'scheduler', 'file uploader', 'image optimizer',
	'PDF generator', 'email template', 'CSV parser', 'JSON validator'
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
const actions = ['task_created', 'task_status_changed', 'task_completed', 'task_updated'];

// --- Config ---
const USER_COUNT = 3000;
const USER_BATCH = 500;
const TASK_BATCH = 2000;
const ACTIVITY_COUNT = 200000;
const ACTIVITY_BATCH = 5000;
const INVITE_COUNT = 500;

const SMALL_PROJECT_COUNT = 15;
const SMALL_PROJECT_TASKS = 1000;
const SMALL_PROJECT_MEMBERS = 50;

const MEGA = [
	{ name: 'Mega Project A', tasks: 35000, memberStart: 0, memberCount: 1000, ownerIdx: 0 },
	{ name: 'Mega Project B', tasks: 35000, memberStart: 1000, memberCount: 1000, ownerIdx: 1000 },
	{ name: 'Project C', tasks: 15000, memberStart: 2000, memberCount: 500, ownerIdx: 2000 }
];

// --- Builders ---
function buildUserData(i: number) {
	return {
		microsoftId: `seed-bulk-${i}`,
		name: `${randomItem(firstNames)} ${randomItem(lastNames)}`,
		email: `user${i}@demo.local`,
		isSuperAdmin: i === 0
	};
}

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
	const dueDate = rand() < 0.1 ? null : (daysFromNow < 0 ? pastDate(-daysFromNow) : futureDate(daysFromNow));

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
		createdAt: pastDate(randomInt(1, 14)),
		...(status === 'DOING' ? { startedAt: pastDate(randomInt(1, 5)) } : {}),
		...(status === 'DONE' ? { startedAt: pastDate(randomInt(5, 10)), completedAt: pastDate(randomInt(1, 3)) } : {})
	};
}

async function createUsers() {
	console.log(`Creating ${USER_COUNT} users...`);
	for (let i = 0; i < USER_COUNT; i += USER_BATCH) {
		const batch = Array.from({ length: Math.min(USER_BATCH, USER_COUNT - i) }, (_, j) => buildUserData(i + j));
		await prisma.user.createMany({ data: batch, skipDuplicates: true });
		if ((i + USER_BATCH) % 1000 === 0 || i + USER_BATCH >= USER_COUNT) {
			console.log(`  ... ${Math.min(i + USER_BATCH, USER_COUNT)} / ${USER_COUNT} users`);
		}
	}
	const rows = await prisma.user.findMany({
		where: { microsoftId: { startsWith: 'seed-bulk-' } },
		select: { id: true, microsoftId: true }
	});
	const bySeedIdx = new Map(rows.map((u) => [Number(u.microsoftId.slice('seed-bulk-'.length)), u.id]));
	const existingIds = rows.map((u) => u.id);
	const users = Array.from({ length: USER_COUNT }, (_, i) => bySeedIdx.get(i) ?? existingIds[i % existingIds.length] ?? 0);
	console.log(`Created ${rows.length} users (ids ${existingIds[0]}..${existingIds[existingIds.length - 1]}).`);
	return users;
}

async function createProject(name: string, ownerId: number, memberIds: number[], description: string) {
	const members = memberIds.filter((id) => id !== ownerId);
	const project = await prisma.project.create({
		data: {
			name,
			description,
			status: 'ACTIVE',
			tags: ['load-test', 'demo'],
			deadline: futureDate(30),
			createdById: ownerId,
			members: {
				create: [
					{ userId: ownerId, role: 'ADMIN', isOwner: true },
					...members.map((id) => ({ userId: id, role: 'MEMBER' as const }))
				]
			}
		}
	});
	console.log(`  Project "${name}" id=${project.id}, ${members.length + 1} members`);
	return project;
}

async function createTasks(projectId: number, count: number, memberPool: number[], ownerId: number) {
	let total = 0;
	for (let i = 0; i < count; i += TASK_BATCH) {
		const batch = Array.from({ length: Math.min(TASK_BATCH, count - i) }, (_, j) =>
			buildTaskData(projectId, i + j, memberPool, ownerId)
		);
		await prisma.task.createMany({ data: batch });
		total += batch.length;
	}
	const actual = await prisma.task.count({ where: { projectId } });
	console.log(`  ... ${actual} / ${count} tasks`);
	return actual;
}

async function createStatusHistory() {
	const doneTasks = await prisma.task.findMany({ where: { status: { in: ['DOING', 'DONE'] } }, select: { id: true, status: true, createdById: true }, take: 200000 });
	console.log(`Creating status history for ${doneTasks.length} tasks...`);
	const rows = doneTasks.flatMap((t) => {
		const changedById = t.createdById;
		if (t.status === 'DOING') {
			return [{ taskId: t.id, changedById, fromStatus: 'TODO' as const, toStatus: 'DOING' as const, changedAt: pastDate(randomInt(1, 5)) }];
		}
		return [
			{ taskId: t.id, changedById, fromStatus: 'TODO' as const, toStatus: 'DOING' as const, changedAt: pastDate(randomInt(5, 10)) },
			{ taskId: t.id, changedById, fromStatus: 'DOING' as const, toStatus: 'DONE' as const, changedAt: pastDate(randomInt(1, 3)) }
		];
	});
	for (let i = 0; i < rows.length; i += TASK_BATCH) {
		await prisma.taskStatusHistory.createMany({ data: rows.slice(i, i + TASK_BATCH) });
	}
	console.log(`Created ${rows.length} status history entries.`);
}

async function createActivity(projectIds: number[], userIds: number[]) {
	console.log(`Creating ${ACTIVITY_COUNT} activity logs...`);
	const count = projectIds.length;
	for (let i = 0; i < ACTIVITY_COUNT; i += ACTIVITY_BATCH) {
		const batch = Array.from({ length: Math.min(ACTIVITY_BATCH, ACTIVITY_COUNT - i) }, () => ({
			projectId: projectIds[Math.floor(rand() * count)],
			userId: userIds[Math.floor(rand() * userIds.length)],
			action: randomItem(actions),
			entityType: 'task',
			entityId: null,
			createdAt: pastDate(randomInt(0, 14))
		}));
		await prisma.activityLog.createMany({ data: batch });
	}
	console.log(`Created ${ACTIVITY_COUNT} activity logs.`);
}

async function createInvites(projectIds: number[], userIds: number[]) {
	console.log(`Creating ${INVITE_COUNT} invites...`);
	const batch = Array.from({ length: INVITE_COUNT }, () => ({
		projectId: randomItem(projectIds),
		invitedById: randomItem(userIds),
		invitedEmail: `invite${randomInt(0, 99999)}@demo.local`,
		status: 'PENDING' as const,
		createdAt: pastDate(randomInt(0, 7)),
		expiresAt: futureDate(randomInt(7, 30))
	}));
	await prisma.projectInvite.createMany({ data: batch });
	console.log(`Created ${INVITE_COUNT} invites.`);
}

async function main() {
	console.log('=== Bulk seed for load testing ===');
	console.log(`Target: ${process.env.DATABASE_URL ?? '(default)'}\n`);

	// 1. Users
	const users = await createUsers();

	// 2. Mega projects
	console.log('Creating mega projects + members...');
	const megaProjectIds: number[] = [];
	for (const m of MEGA) {
		const ownerId = users[m.ownerIdx];
		const memberIds = users.slice(m.memberStart, m.memberStart + m.memberCount);
		const project = await createProject(m.name, ownerId, memberIds, 'Load-test mega project.');
		megaProjectIds.push(project.id);
		const memberPool = [...memberIds.slice(0, 10), ownerId];
		console.log(`  Seeding ${m.tasks} tasks...`);
		await createTasks(project.id, m.tasks, memberPool, ownerId);
	}

	// 3. Small projects
	console.log('Creating small projects...');
	const smallPool = users.slice(2500, 3000);
	const smallProjectIds: number[] = [];
	for (let p = 0; p < SMALL_PROJECT_COUNT; p++) {
		const ownerId = smallPool[(p * 13) % smallPool.length];
		const memberIds = Array.from({ length: SMALL_PROJECT_MEMBERS }, (_, j) => smallPool[(p * 17 + j) % smallPool.length]);
		const project = await createProject(`Project ${String.fromCharCode(65 + p)}`, ownerId, memberIds, 'Small load-test project.');
		smallProjectIds.push(project.id);
		const memberPool = [...memberIds.slice(0, 10), ownerId];
		await createTasks(project.id, SMALL_PROJECT_TASKS, memberPool, ownerId);
	}

	// 4. Status history
	await createStatusHistory();

	// 5. Activity logs
	const allProjectIds = [...megaProjectIds, ...smallProjectIds];
	await createActivity(allProjectIds, users.slice(0, 500));

	// 6. Invites
	await createInvites(allProjectIds, users.slice(0, 500));

	// --- Summary ---
	const totalUsers = await prisma.user.count();
	const totalProjects = await prisma.project.count();
	const totalTasks = await prisma.task.count();
	const totalActivity = await prisma.activityLog.count();
	const totalMembers = await prisma.projectMember.count();

	console.log('\n--- Bulk seed complete ---');
	console.log(`Users:        ${totalUsers}`);
	console.log(`Projects:     ${totalProjects}`);
	console.log(`Tasks:        ${totalTasks}`);
	console.log(`Activity:     ${totalActivity}`);
	console.log(`Memberships:  ${totalMembers}`);
	console.log(`Mega projects: ${megaProjectIds.join(', ')}`);
	console.log(`Small projects: ${smallProjectIds.join(', ')}`);
}

main()
	.catch((e) => {
		console.error('Seed failed:', e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
