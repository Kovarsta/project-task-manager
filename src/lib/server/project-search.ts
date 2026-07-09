type DateRange = { gte: Date; lt: Date } | { gte: Date };

function parseDateQuery(q: string): DateRange | null {
	// YYYY-MM-DD or YYYY/MM/DD
	const isoMatch = q.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
	if (isoMatch) {
		const start = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
		const end = new Date(start);
		end.setDate(end.getDate() + 1);
		return { gte: start, lt: end };
	}

	// DD/MM/YYYY or D/M/YYYY
	const euMatch = q.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
	if (euMatch) {
		const start = new Date(Number(euMatch[3]), Number(euMatch[2]) - 1, Number(euMatch[1]));
		const end = new Date(start);
		end.setDate(end.getDate() + 1);
		return { gte: start, lt: end };
	}

	// YYYY (4 digits)
	const yearMatch = q.match(/^(\d{4})$/);
	if (yearMatch) {
		const year = Number(yearMatch[1]);
		return {
			gte: new Date(year, 0, 1),
			lt: new Date(year + 1, 0, 1)
		};
	}

	// MM/YYYY
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

export function projectSearchFilter(q: string) {
	const conditions: Record<string, unknown>[] = [
		{ name: { contains: q, mode: 'insensitive' } },
		{ tags: { has: q.toLowerCase() } },
		{ description: { contains: q, mode: 'insensitive' } }
	];

	const dateRange = parseDateQuery(q);
	if (dateRange) {
		conditions.push({ deadline: dateRange });
	}

	return { OR: conditions };
}
