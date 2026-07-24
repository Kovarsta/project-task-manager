import type { Prisma } from '@prisma/client';

type DateRange = { gte: Date; lt: Date } | { gte: Date };

function parseDateQuery(q: string): DateRange | null {
	const isoMatch = q.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
	if (isoMatch) {
		const start = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
		const end = new Date(start);
		end.setDate(end.getDate() + 1);
		return { gte: start, lt: end };
	}

	const euMatch = q.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
	if (euMatch) {
		const start = new Date(Number(euMatch[3]), Number(euMatch[2]) - 1, Number(euMatch[1]));
		const end = new Date(start);
		end.setDate(end.getDate() + 1);
		return { gte: start, lt: end };
	}

	const yearMatch = q.match(/^(\d{4})$/);
	if (yearMatch) {
		const year = Number(yearMatch[1]);
		return {
			gte: new Date(year, 0, 1),
			lt: new Date(year + 1, 0, 1)
		};
	}

	const monthYearMatch = q.match(/^(\d{1,2})[-/](\d{4})$/);
	if (monthYearMatch) {
		const month = Number(monthYearMatch[1]) - 1;
		const year = Number(monthYearMatch[2]);
		return {
			gte: new Date(year, month, 1),
			lt: new Date(year, month + 1, 1)
		};
	}

	return null;
}

export function projectSearchFilter(q: string): Prisma.ProjectWhereInput {
	const conditions: Prisma.ProjectWhereInput[] = [
		{ name: { contains: q, mode: 'insensitive' } },
		{ tags: { has: q.toLowerCase() } },
		{ description: { contains: q, mode: 'insensitive' } },
		{ createdBy: { name: { contains: q, mode: 'insensitive' } } },
		{ createdBy: { email: { contains: q, mode: 'insensitive' } } }
	];

	const deadlineRange = parseDateQuery(q);
	if (deadlineRange) {
		conditions.push({ deadline: deadlineRange });
		conditions.push({ createdAt: deadlineRange });
	}

	return { OR: conditions };
}
