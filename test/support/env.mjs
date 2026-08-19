// Environment access lives here, in JavaScript, on purpose.
//
// The n8n community-node lint rules ban the `process` global in every .ts file in the
// repository, and strict mode forbids scoping those rules to nodes/ and credentials/. Keeping
// the one place that reads environment variables in a .mjs module lets the test suite stay
// TypeScript everywhere else.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function fromEnvFile() {
	const path = resolve(import.meta.dirname, '../../.env.test');
	if (!existsSync(path)) return {};

	const values = {};
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
		if (match) values[match[1]] = match[2];
	}
	return values;
}

const fileValues = fromEnvFile();

/** Base URL of the Medusa server under test, or undefined when none is configured. */
export const medusaBaseUrl = process.env.MEDUSA_BASE_URL ?? fileValues.MEDUSA_BASE_URL;

/** Secret API key for the Medusa server under test, or undefined when none is configured. */
export const medusaApiToken = process.env.MEDUSA_API_TOKEN ?? fileValues.MEDUSA_API_TOKEN;

/** True when a Medusa server is configured, so integration tests can skip instead of fail. */
export const hasMedusa = Boolean(medusaBaseUrl && medusaApiToken);
