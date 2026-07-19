import { error } from '@sveltejs/kit';

export function parseIdParam(value: string | undefined, name: string): number {
	if (!value) throw error(400, `Missing parameter: ${name}`);
	const num = Number(value);
	if (!Number.isInteger(num) || num <= 0) throw error(400, `Invalid ${name}: must be a positive integer`);
	return num;
}
