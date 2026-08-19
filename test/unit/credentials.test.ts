import { describe, expect, it } from 'vitest';
import { MedusaApi } from '../../credentials/MedusaApi.credentials';

const credential = new MedusaApi();

function property(name: string) {
	const match = credential.properties.find((candidate) => candidate.name === name);
	if (!match) throw new Error(`credential has no "${name}" property`);
	return match;
}

describe('MedusaApi credential', () => {
	it('is registered under the name the node asks for', () => {
		expect(credential.name).toBe('medusaApi');
	});

	it('collects a base URL and an API token, and nothing else', () => {
		expect(credential.properties.map((p) => p.name).sort()).toEqual(['apiToken', 'baseUrl']);
	});

	it('does not default the base URL to a hosted service', () => {
		expect(property('baseUrl').default).toBe('');
		expect(property('baseUrl').required).toBe(true);
	});

	it('masks the API token', () => {
		expect(property('apiToken').typeOptions?.password).toBe(true);
	});

	describe('authentication', () => {
		const header = (credential.authenticate as { properties: { headers: Record<string, string> } })
			.properties.headers.Authorization;

		// Medusa's Admin API declares api_token as an HTTP Basic scheme and accepts the secret key
		// unencoded. Bearer is for JWTs, which expire and so cannot back a stored credential.
		it('sends the token using the Basic scheme, not Bearer', () => {
			expect(header).toContain('Basic');
			expect(header).not.toContain('Bearer');
		});

		it('sends the token itself rather than a base64 user:password pair', () => {
			expect(header).toBe('=Basic {{ $credentials.apiToken }}');
		});
	});

	describe('credential test request', () => {
		const request = credential.test.request;

		// Regression test. /admin/users/me returns 404 for a valid secret API key, because the key
		// authenticates as an API key and there is no user to resolve. Probing it reported every
		// correct credential as broken.
		it('does not probe the "me" route', () => {
			expect(request.url).not.toContain('/me');
		});

		it('probes an admin collection route', () => {
			expect(request.url).toBe('/admin/users');
			expect(request.method).toBe('GET');
		});

		it('asks for a single record rather than a full page', () => {
			expect(request.qs).toEqual({ limit: 1 });
		});

		it('strips trailing slashes from the base URL', () => {
			expect(request.baseURL).toBe('={{ $credentials.baseUrl.replace(/\\/+$/, "") }}');
		});
	});
});
