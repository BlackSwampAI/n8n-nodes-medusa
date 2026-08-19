import { describe, expect, it } from 'vitest';
import { describeMedusaError, medusaServerMessage } from '../../nodes/Medusa/shared/errors';

describe('medusaServerMessage', () => {
	it('reads the message Medusa sends', () => {
		expect(medusaServerMessage({ type: 'invalid_data', message: 'title is required' })).toBe(
			'title is required',
		);
	});

	it('parses a JSON string body', () => {
		expect(medusaServerMessage('{"message":"handle already exists"}')).toBe(
			'handle already exists',
		);
	});

	it('joins a list of field errors', () => {
		expect(
			medusaServerMessage({ errors: [{ message: 'title required' }, { message: 'bad status' }] }),
		).toBe('title required; bad status');
	});

	it('ignores an HTML body, which carries no useful message', () => {
		expect(medusaServerMessage('<!doctype html><html></html>')).toBeUndefined();
	});

	it('returns nothing when there is no message to find', () => {
		expect(medusaServerMessage({ type: 'unknown' })).toBeUndefined();
		expect(medusaServerMessage(undefined)).toBeUndefined();
	});
});

describe('describeMedusaError', () => {
	const withStatus = (statusCode: number, body?: unknown) => ({ statusCode, response: { body } });

	it('tells an authentication failure apart and names the likely cause', () => {
		const described = describeMedusaError(withStatus(401));
		expect(described.message).toMatch(/rejected the API token/i);
		expect(described.description).toMatch(/secret API key/i);
		expect(described.description).toMatch(/publishable/i);
	});

	it('treats 403 as an authentication problem too', () => {
		expect(describeMedusaError(withStatus(403)).message).toMatch(/rejected the API token/i);
	});

	it('names the resource and ID that were not found', () => {
		const described = describeMedusaError(withStatus(404), {
			resource: 'product',
			resourceId: 'prod_123',
		});
		expect(described.message).toBe('product prod_123 was not found');
	});

	it('never reports a bare "Not Found"', () => {
		expect(describeMedusaError(withStatus(404)).message).not.toBe('Not Found');
	});

	// Validation messages name the offending field, so Medusa's own wording is the useful part.
	it('preserves the server message verbatim on a validation failure', () => {
		const described = describeMedusaError(
			withStatus(400, { type: 'invalid_data', message: 'title must be a string' }),
		);
		expect(described.message).toBe('title must be a string');
	});

	it('treats 422 as validation as well', () => {
		expect(describeMedusaError(withStatus(422, { message: 'bad handle' })).message).toBe(
			'bad handle',
		);
	});

	it('explains a conflict in terms of what usually causes it', () => {
		expect(describeMedusaError(withStatus(409)).description).toMatch(
			/duplicate|no longer applies/i,
		);
	});

	it('marks rate limiting clearly', () => {
		expect(describeMedusaError(withStatus(429)).message).toMatch(/rate limit/i);
	});

	it('attributes a 5xx to Medusa rather than to the request', () => {
		expect(describeMedusaError(withStatus(503)).description).toMatch(/inside Medusa/i);
	});

	describe('connection failures', () => {
		it('distinguishes an unresolvable host', () => {
			const described = describeMedusaError(
				{ code: 'ENOTFOUND' },
				{ baseUrl: 'https://typo.example.com' },
			);
			expect(described.message).toMatch(/could not resolve/i);
			expect(described.message).toContain('https://typo.example.com');
		});

		it('distinguishes a refused connection from an auth failure', () => {
			const described = describeMedusaError({ code: 'ECONNREFUSED' });
			expect(described.message).toMatch(/could not connect/i);
			expect(described.description).toMatch(/running|port/i);
		});

		it('distinguishes a timeout', () => {
			expect(describeMedusaError({ code: 'ETIMEDOUT' }).message).toMatch(/timed out/i);
		});

		it('explains a TLS failure', () => {
			expect(describeMedusaError({ code: 'CERT_HAS_EXPIRED' }).message).toMatch(/certificate/i);
		});

		it('reads a nested cause, which is where fetch puts the code', () => {
			expect(describeMedusaError({ cause: { code: 'ECONNREFUSED' } }).message).toMatch(
				/could not connect/i,
			);
		});
	});

	// The single most common credential mistake: a base URL pointing at the storefront.
	it('recognises an HTML response as a wrong base URL rather than an API error', () => {
		const described = describeMedusaError(withStatus(200, '<!doctype html><html>Shop</html>'));
		expect(described.message).toMatch(/web page/i);
		expect(described.description).toMatch(/storefront|Base URL/i);
	});

	it('falls back to something usable for an unrecognised failure', () => {
		const described = describeMedusaError({ message: 'socket hang up' });
		expect(described.message).toBe('socket hang up');
	});

	it('never leaks an authorization header into the message', () => {
		const described = describeMedusaError({
			statusCode: 401,
			response: { body: { message: 'unauthorized' } },
			// Simulates an error object carrying the outgoing request, as HTTP clients often do.
			options: { headers: { Authorization: 'Basic sk_supersecret_value' } },
		} as never);
		expect(JSON.stringify(described)).not.toContain('sk_supersecret_value');
	});
});
