import type { Prisma } from '@prisma/client';

function parseDateQueryUTC(q: string): { gte: Date; lt: Date } | null {
	const isoMatch = q.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
	if (isoMatch) {
		const [, y, m, d] = isoMatch.map(Number);
		const start = new Date(Date.UTC(y, m - 1, d));
		const end = new Date(Date.UTC(y, m - 1, d + 1));
		return { gte: start, lt: end };
	}

	const euMatch = q.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
	if (euMatch) {
		const [, d, m, y] = euMatch.map(Number);
		const start = new Date(Date.UTC(y, m - 1, d));
		const end = new Date(Date.UTC(y, m - 1, d + 1));
		return { gte: start, lt: end };
	}

	const yearMatch = q.match(/^(\d{4})$/);
	if (yearMatch) {
		const year = Number(yearMatch[1]);
		return {
			gte: new Date(Date.UTC(year, 0, 1)),
			lt: new Date(Date.UTC(year + 1, 0, 1))
		};
	}

	const monthYearMatch = q.match(/^(\d{1,2})[-/](\d{4})$/);
	if (monthYearMatch) {
		const month = Number(monthYearMatch[1]) - 1;
		const year = Number(monthYearMatch[2]);
		return {
			gte: new Date(Date.UTC(year, month, 1)),
			lt: new Date(Date.UTC(year, month + 1, 1))
		};
	}

	return null;
}

export function taskSearchFilter(q: string): Prisma.TaskWhereInput {
	const conditions: Prisma.TaskWhereInput[] = [
		{ title: { contains: q, mode: 'insensitive' } },
		{ assignee: { name: { contains: q, mode: 'insensitive' } } }
	];

	if (q.length >= 2) {
		conditions.push({ tags: { has: q.toLowerCase() } });
	}

	const dateRange = parseDateQueryUTC(q);
	if (dateRange) {
		conditions.push({ dueDate: dateRange });
	}

	return { OR: conditions };
}
