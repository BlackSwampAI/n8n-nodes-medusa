import { describe, expect, it } from 'vitest';
import { MedusaApi } from '../../credentials/MedusaApi.credentials';
import { hasMedusa, medusaApiToken, medusaBaseUrl } from '../support/env.mjs';

// Skips rather than fails when no Medusa is configured, so the suite still runs for contributors
// without Docker. Start one with: npm run medusa:up
const describeMedusa = hasMedusa ? describe : describe.skip;

const baseUrl = String(medusaBaseUrl ?? '').replace(/\/+$/, '');

// Note the null rather than undefined: an explicit `undefined` argument would re-trigger the
// default parameter and silently send the real token.
async function get(path: string, token: string | null = medusaApiToken ?? null) {
	return fetch(`${baseUrl}${path}`, {
		headers: token ? { Authorization: `Basic ${token}` } : {},
	});
}

describeMedusa('MedusaApi credential against a live Medusa server', () => {
	const credentialTest = new MedusaApi().test.request;

	it('authenticates with the Basic scheme and an unencoded secret key', async () => {
		const response = await get('/admin/users?limit=1');
		expect(response.status).toBe(200);
	});

	// This is the test that would have caught the original probe route. It drives the request
	// straight from the credential definition, so the credential cannot drift away from a route
	// that actually works.
	it('succeeds against the route the credential test actually probes', async () => {
		const query = new URLSearchParams(
			Object.entries(credentialTest.qs ?? {}).map(([key, value]) => [key, String(value)]),
		).toString();
		const response = await get(`${credentialTest.url}${query ? `?${query}` : ''}`);
		expect(response.status).toBe(200);
	});

	it('returns 404 on /admin/users/me, which is why that route cannot be the probe', async () => {
		const response = await get('/admin/users/me');
		expect(response.status).toBe(404);
	});

	it('rejects an invalid token with 401 rather than a network error', async () => {
		const response = await get('/admin/users?limit=1', 'sk_definitely_not_a_real_key');
		expect(response.status).toBe(401);
	});

	it('rejects a missing token with 401', async () => {
		const response = await get('/admin/users?limit=1', null);
		expect(response.status).toBe(401);
	});

	// Justifies the trailing-slash stripping in the credential's baseURL expression: without it a
	// base URL ending in "/" produces a doubled separator that Medusa does not route.
	it('does not route a doubled path separator', async () => {
		const response = await fetch(`${baseUrl}//admin/users?limit=1`, {
			headers: { Authorization: `Basic ${medusaApiToken}` },
		});
		expect(response.status).not.toBe(200);
	});
});
