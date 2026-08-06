import 'dotenv/config';
import { encode } from '@auth/core/jwt';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const arg = process.argv[2];
const emails = arg && !/^\d+$/.test(arg)
	? arg.split(',')
	: Array.from({ length: Number(arg ?? 250) }, (_, i) => `user${i}@demo.local`);
const secret = process.env.AUTH_SECRET;
if (!secret) {
	console.error('AUTH_SECRET not found in .env');
	process.exit(1);
}

// Salt must match the cookie name used by @auth/sveltekit on http (non-secure) cookies.
const salt = 'authjs.session-token';
const maxAge = 60 * 60 * 24;

const tokens = [];
for (const email of emails) {
	const name = email.split('@')[0].replace(/^user/, 'Load Test User ');
	const token = await encode({
		token: { sub: email, name, email, picture: null },
		secret,
		salt,
		maxAge
	});
	tokens.push({ email, token });
}

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'tokens.js');
writeFileSync(outPath, `export default ${JSON.stringify(tokens)};\n`);
console.log(`Minted ${tokens.length} session tokens -> ${outPath}`);
