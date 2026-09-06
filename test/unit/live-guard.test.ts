import { describe, expect, it } from 'vitest';
import {
	assertDisposableMedusaTarget,
	validateDisposableMedusaConfiguration,
} from '../support/live-guard.mjs';

describe('destructive Medusa integration guard', () => {
	it('accepts only an explicitly disposable loopback target', () => {
		expect(assertDisposableMedusaTarget('http://127.0.0.1:9000', 'secret', 'true')).toBe(
			'http://127.0.0.1:9000',
		);
		expect(assertDisposableMedusaTarget('http://[::1]:9000', 'secret', 'true')).toBe(
			'http://[::1]:9000',
		);
	});

	it.each([
		['https://commerce.example.com', 'secret', 'true'],
		['http://localhost:9000', 'secret', undefined],
		['http://localhost:9000', 'secret', 'false'],
	])('rejects unsafe target %s', (url, token, marker) => {
		expect(() => assertDisposableMedusaTarget(url, token, marker)).toThrow(
			'loopback URL and MEDUSA_DISPOSABLE_TEST_ENV=true',
		);
	});

	it('rejects unsupported protocols before transport', () => {
		expect(() => assertDisposableMedusaTarget('ftp://localhost:9000', 'secret', 'true')).toThrow(
			'HTTP(S)',
		);
	});

	it.each([undefined, '', '   '])('rejects a missing or blank token (%s)', (token) => {
		expect(() => assertDisposableMedusaTarget('http://localhost:9000', token, 'true')).toThrow(
			'nonblank MEDUSA_API_TOKEN',
		);
	});

	it('skips only a wholly unconfigured integration environment', () => {
		expect(validateDisposableMedusaConfiguration(undefined, undefined, undefined)).toBe(false);
		expect(() => validateDisposableMedusaConfiguration(undefined, 'secret', 'true')).toThrow(
			'valid loopback MEDUSA_BASE_URL',
		);
		expect(() =>
			validateDisposableMedusaConfiguration('http://localhost:9000', undefined, 'true'),
		).toThrow('nonblank MEDUSA_API_TOKEN');
	});
});
