import { describe, expect, it } from 'vitest';
import {
	registeredCredentials,
	registeredNodes,
	sourceExists,
	toSourcePath,
} from '../support/manifest.mjs';

// Neither lint nor build catches a node that is built but never registered, or registered under
// a path that no longer exists. The package installs into n8n and the node is simply absent.
describe('package.json n8n registration', () => {
	it('registers at least one node', () => {
		expect(registeredNodes.length).toBeGreaterThan(0);
	});

	it('registers at least one credential', () => {
		expect(registeredCredentials.length).toBeGreaterThan(0);
	});

	for (const distPath of registeredNodes) {
		it(`registered node ${distPath} has matching source`, () => {
			expect(sourceExists(distPath)).toBe(true);
		});
	}

	for (const distPath of registeredCredentials) {
		it(`registered credential ${distPath} has matching source`, () => {
			expect(sourceExists(distPath)).toBe(true);
		});
	}

	it('registers the Medusa credential the node declares', () => {
		expect(registeredCredentials.map(toSourcePath)).toContain(
			'credentials/MedusaApi.credentials.ts',
		);
	});
});
