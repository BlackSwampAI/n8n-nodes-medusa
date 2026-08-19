import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { describeMedusaError } from '../../nodes/Medusa/shared/errors';
import { collectAll, extractPage } from '../../nodes/Medusa/shared/transport';
import { hasMedusa, medusaApiToken, medusaBaseUrl } from '../support/env.mjs';

const describeMedusa = hasMedusa ? describe : describe.skip;
const baseUrl = String(medusaBaseUrl ?? '').replace(/\/+$/, '');

// Every fixture carries a prefix unique to this run, so a crashed run leaves nothing that a later
// run will trip over, and two runs cannot collide on the same server.
const prefix = `n8n-it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

interface ApiResult {
	status: number;
	body: unknown;
}

async function api(
	path: string,
	init: RequestInit = {},
	token = medusaApiToken,
): Promise<ApiResult> {
	const response = await fetch(`${baseUrl}${path}`, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Basic ${token}` } : {}),
			...(init.headers ?? {}),
		},
	});
	const text = await response.text();
	let body: unknown = text;
	try {
		body = JSON.parse(text);
	} catch {
		// Left as text; the error mapper is expected to cope with non-JSON bodies.
	}
	return { status: response.status, body };
}

/** Shapes a fetch result the way an HTTP client surfaces a failure, for the error mapper. */
function asThrownError(result: ApiResult) {
	return { statusCode: result.status, response: { body: result.body } };
}

async function createProduct(name: string) {
	const result = await api('/admin/products', {
		method: 'POST',
		body: JSON.stringify({
			title: `${prefix} ${name}`,
			status: 'draft',
			options: [{ title: 'Size', values: ['One Size'] }],
			variants: [
				{
					title: 'Default',
					options: { Size: 'One Size' },
					prices: [{ currency_code: 'usd', amount: 1000 }],
				},
			],
		}),
	});
	if (result.status !== 200) {
		throw new Error(`fixture creation failed (${result.status}): ${JSON.stringify(result.body)}`);
	}
	return (result.body as { product: { id: string } }).product;
}

const FIXTURE_COUNT = 5;

describeMedusa('transport against a live Medusa server', () => {
	beforeAll(async () => {
		for (let index = 0; index < FIXTURE_COUNT; index++) {
			await createProduct(`item ${index}`);
		}
	}, 120_000);

	afterAll(async () => {
		const listed = await api(`/admin/products?q=${encodeURIComponent(prefix)}&limit=100`);
		const products = (listed.body as { products?: Array<{ id: string }> }).products ?? [];
		for (const product of products) {
			await api(`/admin/products/${product.id}`, { method: 'DELETE' });
		}
	}, 120_000);

	/** Reads one page of this run's fixtures, the way medusaApiRequestAllItems does. */
	async function fetchPage({ limit, offset }: { limit: number; offset: number }) {
		const result = await api(
			`/admin/products?q=${encodeURIComponent(prefix)}&limit=${limit}&offset=${offset}`,
		);
		expect(result.status).toBe(200);
		return extractPage<{ id: string; title: string }>(result.body, 'products');
	}

	it('reads a real list response into items and a total count', async () => {
		const page = await fetchPage({ limit: 100, offset: 0 });
		expect(page.count).toBe(FIXTURE_COUNT);
		expect(page.items).toHaveLength(FIXTURE_COUNT);
	});

	// The whole point of the paging loop: more records than fit in one request.
	it('pages through every record when the page size is smaller than the total', async () => {
		const calls: number[] = [];
		const items = await collectAll(
			async (params) => {
				calls.push(params.offset);
				return fetchPage(params);
			},
			{ returnAll: true, limit: 0, pageSize: 2 },
		);

		expect(items).toHaveLength(FIXTURE_COUNT);
		expect(calls).toEqual([0, 2, 4]);
		expect(new Set(items.map((item) => item.id)).size).toBe(FIXTURE_COUNT);
	});

	it('stops at the limit without reading further pages', async () => {
		const calls: number[] = [];
		const items = await collectAll(
			async (params) => {
				calls.push(params.offset);
				return fetchPage(params);
			},
			{ returnAll: false, limit: 3 },
		);

		expect(items).toHaveLength(3);
		expect(calls).toEqual([0]);
	});

	it('returns an empty list for a filter that matches nothing', async () => {
		const items = await collectAll(
			async ({ limit, offset }) => {
				const result = await api(
					`/admin/products?q=no-such-product-xyz&limit=${limit}&offset=${offset}`,
				);
				return extractPage(result.body, 'products');
			},
			{ returnAll: true, limit: 0 },
		);
		expect(items).toEqual([]);
	});

	// These assert the error mapping against responses Medusa actually produces, rather than
	// against hand-written objects that might not match reality.
	describe('error mapping against real responses', () => {
		it('maps a rejected token to an authentication failure', async () => {
			const result = await api('/admin/products?limit=1', {}, 'sk_not_a_real_key');
			expect(result.status).toBe(401);
			expect(describeMedusaError(asThrownError(result)).message).toMatch(/rejected the API token/i);
		});

		it('maps a missing record to a named 404', async () => {
			const result = await api('/admin/products/prod_does_not_exist');
			expect(result.status).toBe(404);
			const described = describeMedusaError(asThrownError(result), {
				resource: 'product',
				resourceId: 'prod_does_not_exist',
			});
			expect(described.message).toBe('product prod_does_not_exist was not found');
		});

		it("preserves Medusa's own wording on a validation failure", async () => {
			const result = await api('/admin/products', {
				method: 'POST',
				body: JSON.stringify({ title: `${prefix} invalid` }),
			});
			expect(result.status).toBe(400);
			// Medusa answers { type: 'invalid_data', message: 'Product options are not provided...' }
			expect(describeMedusaError(asThrownError(result)).message).toMatch(
				/options are not provided/i,
			);
		});
	});
});
