#!/usr/bin/env node
// Brings up the disposable Medusa environment and mints an Admin API token for the integration
// suite, writing it to .env.test.
//
// Medusa has no way to create the first credential over the API — there is nothing to
// authenticate with yet — so the sequence is: create an admin user through the CLI inside the
// container, exchange that user's password for a JWT, then use the JWT to create a secret API
// key. The secret key is what the node's credential uses, because it does not expire.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const BASE_URL = process.env.MEDUSA_BASE_URL ?? 'http://localhost:9000';
const EMAIL = process.env.MEDUSA_ADMIN_EMAIL ?? 'admin@medusa.test';
const PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD ?? 'supersecret';

function compose(args, options = {}) {
	return spawnSync('docker', ['compose', ...args], {
		cwd: root,
		encoding: 'utf8',
		stdio: options.capture ? 'pipe' : 'inherit',
		...options,
	});
}

function die(message) {
	console.error(`\n✖ ${message}`);
	process.exit(1);
}

async function request(path, { method = 'GET', token, tokenType = 'Bearer', body } = {}) {
	const response = await fetch(`${BASE_URL}${path}`, {
		method,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `${tokenType} ${token}` } : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});
	const text = await response.text();
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		parsed = text;
	}
	return { ok: response.ok, status: response.status, body: parsed };
}

async function waitForHealth(timeoutMs = 300_000) {
	const deadline = Date.now() + timeoutMs;
	process.stdout.write('> waiting for medusa to become healthy');
	while (Date.now() < deadline) {
		try {
			const response = await fetch(`${BASE_URL}/health`);
			if (response.ok) {
				process.stdout.write(' ok\n');
				return;
			}
		} catch {
			// Server is not accepting connections yet.
		}
		process.stdout.write('.');
		await new Promise((r) => setTimeout(r, 3000));
	}
	process.stdout.write('\n');
	die(`Medusa did not become healthy within ${timeoutMs / 1000}s. Try: docker compose logs medusa`);
}

async function main() {
	const command = process.argv[2] ?? 'up';

	if (command === 'down') {
		compose(['down', '--volumes', '--remove-orphans']);
		return;
	}

	if (command !== 'up') die(`Unknown command "${command}". Use "up" or "down".`);

	const build = compose(['up', '--build', '--detach']);
	if (build.status !== 0) die('docker compose up failed');

	await waitForHealth();

	// The CLI exits non-zero when the user already exists, which is fine on a re-run.
	console.log('> ensuring admin user exists');
	const user = compose(
		['exec', '-T', 'medusa', 'npx', 'medusa', 'user', '-e', EMAIL, '-p', PASSWORD],
		{
			capture: true,
		},
	);
	const userOutput = `${user.stdout ?? ''}${user.stderr ?? ''}`;
	if (user.status !== 0 && !/already exists/i.test(userOutput)) {
		die(`Could not create the admin user:\n${userOutput}`);
	}

	console.log('> authenticating');
	const auth = await request('/auth/user/emailpass', {
		method: 'POST',
		body: { email: EMAIL, password: PASSWORD },
	});
	if (!auth.ok || !auth.body?.token) {
		die(`Authentication failed (${auth.status}): ${JSON.stringify(auth.body)}`);
	}

	console.log('> creating secret API key');
	const key = await request('/admin/api-keys', {
		method: 'POST',
		token: auth.body.token,
		body: { title: `n8n integration tests ${new Date().toISOString()}`, type: 'secret' },
	});
	if (!key.ok || !key.body?.api_key?.token) {
		die(`Could not create a secret API key (${key.status}): ${JSON.stringify(key.body)}`);
	}
	const token = key.body.api_key.token;

	// Prove the minted key authenticates the way the node's credential will, using the same
	// HTTP Basic scheme rather than the JWT used above.
	//
	// Not /admin/users/me: a secret API key authenticates as an API key rather than as a user,
	// so the "me" route has no user to resolve and answers 404 even for a perfectly valid key.
	const verify = await request('/admin/users?limit=1', { token, tokenType: 'Basic' });
	if (!verify.ok) {
		die(`The minted key did not authenticate against /admin/users (${verify.status})`);
	}

	writeFileSync(
		resolve(root, '.env.test'),
		`MEDUSA_BASE_URL=${BASE_URL}\nMEDUSA_API_TOKEN=${token}\n`,
		'utf8',
	);

	console.log(`\n✔ Medusa is ready at ${BASE_URL}`);
	console.log('  Credentials written to .env.test');
	console.log(`  Verified against /admin/users as ${EMAIL}`);
}

main().catch((error) => die(error.stack ?? String(error)));
