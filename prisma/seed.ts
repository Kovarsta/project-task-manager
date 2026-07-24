import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function randomItem<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
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

function buildTaskData(projectId: number, i: number, memberPool: number[], ownerId: number) {
	const status = statuses[i % 3];
	const priority = randomItem([...priorities]);
	const noun = randomItem(titleNouns);
	const prefix = randomItem(titlePrefixes);
	const description = randomItem(descriptionTemplates).replace('{noun}', noun);

	const tags: string[] = [];
	const tagCount = randomInt(0, 3);
	for (let t = 0; t < tagCount; t++) {
		const tag = randomItem(tagPool);
		if (!tags.includes(tag)) tags.push(tag);
	}

	const daysFromNow = randomInt(-10, 20);
	const dueDate = daysFromNow < 0 ? pastDate(-daysFromNow) : futureDate(daysFromNow);

	const assigneeId = randomItem(memberPool);

	return {
		projectId,
		title: `${prefix} ${noun}`,
		description: i % 4 === 0 ? null : description,
		tags,
		status,
		priority,
		assigneeId,
		createdById: ownerId,
		dueDate,
		createdAt: pastDate(randomInt(1, 14)),
		...(status === 'DOING' ? { startedAt: pastDate(randomInt(1, 5)) } : {}),
		...(status === 'DONE' ? { startedAt: pastDate(randomInt(5, 10)), completedAt: pastDate(randomInt(1, 3)) } : {})
	};
}

async function main() {
	const userEmail = process.env.SEED_USER_EMAIL;
	if (!userEmail) {
		console.error('SEED_USER_EMAIL env var is required. Set it in .env or pass it inline.');
		console.error('Example: SEED_USER_EMAIL="you@example.com" npx prisma db seed');
		process.exit(1);
	}

	console.log('Looking up your user...');
	const owner = await prisma.user.findUnique({ where: { email: userEmail } });
	if (!owner) {
		console.error(`User with email "${userEmail}" not found. Log in first via GitHub OAuth, then re-run.`);
		process.exit(1);
	}
	console.log(`Found user: ${owner.name} (${owner.email}), id=${owner.id}`);

	console.log('Creating 1000 fake users...');
	const fakeUserIds: number[] = [];
	const BATCH = 50;
	for (let i = 0; i < 1000; i += BATCH) {
		const batch = Array.from({ length: Math.min(BATCH, 1000 - i) }, (_, j) => {
			const idx = i + j;
			return {
				microsoftId: `seed-user-${idx}`,
				name: `${randomItem(firstNames)} ${randomItem(lastNames)}`,
				email: `user${idx}@demo.local`
			};
		});

		await prisma.user.createMany({ data: batch, skipDuplicates: true });

		const created = await prisma.user.findMany({
			where: { microsoftId: { in: batch.map((u) => u.microsoftId) } },
			select: { id: true }
		});
		fakeUserIds.push(...created.map((u) => u.id));

		if ((i + BATCH) % 200 === 0 || i + BATCH >= 1000) {
			console.log(`  ... ${Math.min(i + BATCH, 1000)} / 1000 users`);
		}
	}
	console.log(`Created ${fakeUserIds.length} fake users.`);

	// --- OWNED PROJECT ---
	console.log('Creating your project (Demo Project) with 500 tasks...');
	const ownedMemberIds = fakeUserIds.slice(0, 200);
	const ownedMemberPool = [...fakeUserIds.slice(0, 20), owner.id];

	const ownedProject = await prisma.project.create({
		data: {
			name: 'Demo Project',
			description: 'A large demo project seeded to performance-test the application.',
			status: 'ACTIVE',
			tags: ['demo', 'testing', 'seed'],
			deadline: futureDate(30),
			createdById: owner.id,
			members: {
				create: [
					{ userId: owner.id, role: 'ADMIN', isOwner: true },
					...ownedMemberIds.map((id) => ({ userId: id, role: 'MEMBER' as const }))
				]
			}
		}
	});
	console.log(`  Project id=${ownedProject.id}, ${ownedMemberIds.length + 1} members.`);

	console.log('  Creating 500 tasks (batching)...');
	const OWNED_TASKS = 500;
	const taskBatchSize = 50;
	for (let i = 0; i < OWNED_TASKS; i += taskBatchSize) {
		const batch = Array.from({ length: Math.min(taskBatchSize, OWNED_TASKS - i) }, (_, j) =>
			buildTaskData(ownedProject.id, i + j, ownedMemberPool, owner.id)
		);
		await prisma.task.createMany({ data: batch });
		if ((i + taskBatchSize) % 200 === 0 || i + taskBatchSize >= OWNED_TASKS) {
			console.log(`  ... ${Math.min(i + taskBatchSize, OWNED_TASKS)} / ${OWNED_TASKS} tasks`);
		}
	}
	const ownedTaskCount = await prisma.task.count({ where: { projectId: ownedProject.id } });
	console.log(`  Created ${ownedTaskCount} tasks.`);

	// --- PROJECTS OWNED BY FAKE USERS (for admin page) ---
	const OTHER_PROJECTS = 10;
	const FAKE_OWNERS = fakeUserIds.slice(200, 200 + OTHER_PROJECTS);
	// Remaining fake users available for membership
	const remainingFakeIds = fakeUserIds.slice(200 + OTHER_PROJECTS);

	console.log(`Creating ${OTHER_PROJECTS} additional projects owned by fake users...`);

	for (let p = 0; p < OTHER_PROJECTS; p++) {
		const fakeOwnerId = FAKE_OWNERS[p];
		const fakeOwner = await prisma.user.findUnique({ where: { id: fakeOwnerId }, select: { name: true } });

		// Each project gets 80 members from the remaining pool
		const memberIds = remainingFakeIds.slice(p * 80, (p + 1) * 80);
		const memberPool = [...memberIds.slice(0, 10), fakeOwnerId];

		const projectNames = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'];
		const projectStatuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ON_HOLD', 'COMPLETE'] as const;

		const project = await prisma.project.create({
			data: {
				name: `${projectNames[p]} Project`,
				description: `A project owned by ${fakeOwner?.name ?? 'a team member'}, created for performance testing.`,
				status: randomItem([...projectStatuses]),
				tags: [randomItem(tagPool), randomItem(tagPool)].filter((v, i, a) => a.indexOf(v) === i),
				deadline: Math.random() > 0.3 ? futureDate(randomInt(5, 60)) : undefined,
				createdById: fakeOwnerId,
				members: {
					create: [
						{ userId: fakeOwnerId, role: 'ADMIN', isOwner: true },
						...memberIds.map((id) => ({ userId: id, role: 'MEMBER' as const }))
					]
				}
			}
		});

		// ~80 tasks per project
		const TASKS_PER = 80;
		for (let i = 0; i < TASKS_PER; i += taskBatchSize) {
			const batch = Array.from({ length: Math.min(taskBatchSize, TASKS_PER - i) }, (_, j) =>
				buildTaskData(project.id, i + j, memberPool, fakeOwnerId)
			);
			await prisma.task.createMany({ data: batch });
		}

		const taskCount = await prisma.task.count({ where: { projectId: project.id } });
		console.log(`  [${p + 1}/${OTHER_PROJECTS}] ${project.name} — id=${project.id}, ${memberIds.length + 1} members, ${taskCount} tasks`);
	}

	// --- ACTIVITY LOGS ---
	console.log('Creating activity logs...');
	const actions = ['task_created', 'task_status_changed', 'task_completed', 'task_updated'];
	const allProjectIds = [ownedProject.id, ...(await prisma.project.findMany({ where: { id: { not: ownedProject.id } }, select: { id: true } })).map((p) => p.id)];
	const logEntries = allProjectIds.flatMap((pid) =>
		Array.from({ length: 20 }, () => ({
			projectId: pid,
			userId: owner.id,
			action: randomItem(actions),
			entityType: 'task',
			entityId: null,
			createdAt: pastDate(randomInt(0, 14))
		}))
	);
	await prisma.activityLog.createMany({ data: logEntries });
	console.log(`Created ${logEntries.length} activity log entries.`);

	// --- SUMMARY ---
	const totalUsers = await prisma.user.count();
	const totalProjects = await prisma.project.count();
	const totalTasks = await prisma.task.count();
	console.log('\n--- Seed complete ---');
	console.log(`Your user:      ${owner.name} (${owner.email})`);
	console.log(`Total users:    ${totalUsers}`);
	console.log(`Total projects: ${totalProjects}`);
	console.log(`Total tasks:    ${totalTasks}`);
}

main()
	.catch((e) => {
		console.error('Seed failed:', e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
