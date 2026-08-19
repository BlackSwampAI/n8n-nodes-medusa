import { describe, expect, it, vi } from 'vitest';
import {
	buildRequestOptions,
	cleanQuery,
	collectAll,
	extractPage,
	MAX_PAGE_SIZE,
	normalizeBaseUrl,
} from '../../nodes/Medusa/shared/transport';

describe('normalizeBaseUrl', () => {
	it('keeps a well-formed URL unchanged', () => {
		expect(normalizeBaseUrl('https://commerce.example.com')).toBe('https://commerce.example.com');
	});

	it('strips trailing slashes so paths cannot double up', () => {
		expect(normalizeBaseUrl('https://commerce.example.com/')).toBe('https://commerce.example.com');
		expect(normalizeBaseUrl('https://commerce.example.com///')).toBe(
			'https://commerce.example.com',
		);
	});

	it('trims surrounding whitespace, which is easy to paste in', () => {
		expect(normalizeBaseUrl('  http://localhost:9000  ')).toBe('http://localhost:9000');
	});

	it('accepts a local http server', () => {
		expect(normalizeBaseUrl('http://localhost:9000')).toBe('http://localhost:9000');
	});

	it('preserves a sub-path deployment', () => {
		expect(normalizeBaseUrl('https://example.com/medusa')).toBe('https://example.com/medusa');
	});

	// Rejected rather than silently repaired: /admin/admin/products 404s in a way that reads as
	// missing data rather than as a misconfigured credential.
	it('rejects a base URL that already ends in /admin, and names the fix', () => {
		expect(() => normalizeBaseUrl('https://commerce.example.com/admin')).toThrow(
			/Remove the trailing "\/admin".*https:\/\/commerce\.example\.com/s,
		);
	});

	it('rejects a URL with no scheme', () => {
		expect(() => normalizeBaseUrl('commerce.example.com')).toThrow(/must start with http/);
	});

	it('rejects an empty base URL', () => {
		expect(() => normalizeBaseUrl('   ')).toThrow(/No Base URL/);
	});
});

describe('cleanQuery', () => {
	it('drops empty values that would otherwise become stray query parameters', () => {
		expect(cleanQuery({ q: '', limit: 10, order: undefined, offset: 0, title: null })).toEqual({
			limit: 10,
			offset: 0,
		});
	});

	it('keeps false, which is a meaningful filter value', () => {
		expect(cleanQuery({ is_giftcard: false })).toEqual({ is_giftcard: false });
	});
});

describe('buildRequestOptions', () => {
	it('joins the base URL and path without doubling the separator', () => {
		const request = buildRequestOptions('https://example.com/', 'GET', '/admin/products');
		expect(request.url).toBe('https://example.com/admin/products');
	});

	it('sends JSON and carries the body through', () => {
		const request = buildRequestOptions('https://example.com', 'POST', '/admin/products', {
			body: { title: 'Chair' },
		});
		expect(request.json).toBe(true);
		expect(request.body).toEqual({ title: 'Chair' });
		expect(request.method).toBe('POST');
	});

	it('omits a body entirely when there is none', () => {
		expect(buildRequestOptions('https://example.com', 'GET', '/admin/products')).not.toHaveProperty(
			'body',
		);
	});
});

describe('extractPage', () => {
	it('reads the collection named after the resource', () => {
		expect(extractPage({ products: [{ id: '1' }], count: 7 }, 'products')).toEqual({
			items: [{ id: '1' }],
			count: 7,
		});
	});

	it('falls back to the page length when count is absent', () => {
		expect(extractPage({ products: [{ id: '1' }] }, 'products').count).toBe(1);
	});

	it('fails loudly when the collection is missing rather than returning nothing', () => {
		expect(() => extractPage({ count: 0 }, 'products')).toThrow(/no "products" collection/);
	});
});

describe('collectAll', () => {
	/** A Medusa list endpoint holding `total` sequentially numbered records. */
	function server(total: number) {
		const records = Array.from({ length: total }, (_, index) => ({ id: `rec_${index}` }));
		const calls: Array<{ limit: number; offset: number }> = [];
		const fetchPage = vi.fn(async ({ limit, offset }: { limit: number; offset: number }) => {
			calls.push({ limit, offset });
			return { items: records.slice(offset, offset + limit), count: total };
		});
		return { fetchPage, calls };
	}

	it('returns a single page without asking for more', async () => {
		const { fetchPage, calls } = server(3);
		const items = await collectAll(fetchPage, { returnAll: true, limit: 0 });
		expect(items).toHaveLength(3);
		expect(calls).toHaveLength(1);
	});

	it('pages until every record is collected', async () => {
		const { fetchPage, calls } = server(250);
		const items = await collectAll(fetchPage, { returnAll: true, limit: 0 });
		expect(items).toHaveLength(250);
		expect(calls.map((call) => call.offset)).toEqual([0, 100, 200]);
	});

	it('honours a page size below the maximum', async () => {
		const { fetchPage, calls } = server(5);
		const items = await collectAll(fetchPage, { returnAll: true, limit: 0, pageSize: 2 });
		expect(items).toHaveLength(5);
		expect(calls.map((call) => call.offset)).toEqual([0, 2, 4]);
	});

	it('never requests a page larger than the maximum', async () => {
		const { fetchPage, calls } = server(10);
		await collectAll(fetchPage, { returnAll: true, limit: 0, pageSize: 5000 });
		expect(calls[0].limit).toBe(MAX_PAGE_SIZE);
	});

	it('stops at the limit and does not over-fetch', async () => {
		const { fetchPage, calls } = server(250);
		const items = await collectAll(fetchPage, { returnAll: false, limit: 10 });
		expect(items).toHaveLength(10);
		expect(calls).toHaveLength(1);
		expect(calls[0].limit).toBe(10);
	});

	it('trims a page that overshoots the limit', async () => {
		const { fetchPage } = server(100);
		const items = await collectAll(fetchPage, { returnAll: false, limit: 7, pageSize: 20 });
		expect(items).toHaveLength(7);
	});

	it('returns nothing for a zero limit without calling the server', async () => {
		const { fetchPage } = server(10);
		expect(await collectAll(fetchPage, { returnAll: false, limit: 0 })).toEqual([]);
		expect(fetchPage).not.toHaveBeenCalled();
	});

	it('handles an empty collection', async () => {
		const { fetchPage, calls } = server(0);
		expect(await collectAll(fetchPage, { returnAll: true, limit: 0 })).toEqual([]);
		expect(calls).toHaveLength(1);
	});

	// A server that reports more records than it will hand over would otherwise loop forever.
	it('stops on an empty page even when count claims there is more', async () => {
		const fetchPage = vi.fn(async () => ({ items: [], count: 1000 }));
		expect(await collectAll(fetchPage, { returnAll: true, limit: 0 })).toEqual([]);
		expect(fetchPage).toHaveBeenCalledTimes(1);
	});
});
