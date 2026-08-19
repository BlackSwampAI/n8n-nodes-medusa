import { afterAll, describe, expect, it } from 'vitest';
import { routeOperations } from '../../nodes/Medusa/shared/router';
import { hasMedusa, medusaApiToken, medusaBaseUrl } from '../support/env.mjs';
import { createExecuteFunctions } from '../support/harness';

const describeMedusa = hasMedusa ? describe : describe.skip;
const baseUrl = String(medusaBaseUrl ?? '').replace(/\/+$/, '');
const prefix = `n8n-prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createdIds: string[] = [];

interface ProductRecord {
	id: string;
	title: string;
	status: string;
	options: unknown[];
	variants: Array<{ id: string; title: string }>;
}

/** Runs one operation through the real router, exactly as n8n would. */
async function run(parameters: Record<string, unknown>, extra: Record<string, unknown> = {}) {
	const context = createExecuteFunctions({ parameters, ...extra });
	const [output] = await routeOperations.call(context);
	return output;
}

function variant(title: string, amount: number, sku?: string) {
	return { variant: [{ title, currencyCode: 'usd', amount, ...(sku ? { sku } : {}) }] };
}

describeMedusa('product operations against a live Medusa server', () => {
	afterAll(async () => {
		for (const id of createdIds) {
			await fetch(`${baseUrl}/admin/products/${id}`, {
				method: 'DELETE',
				headers: { Authorization: `Basic ${medusaApiToken}` },
			});
		}
	}, 120_000);

	describe('the full lifecycle', () => {
		let productId: string;

		it('creates a product from a title and a single priced variant', async () => {
			const output = await run({
				resource: 'product',
				operation: 'create',
				title: `${prefix} chair`,
				variants: variant('Default', 49.99),
				additionalFields: { status: 'draft' },
			});

			expect(output).toHaveLength(1);
			const product = output[0].json as unknown as ProductRecord;
			productId = product.id;
			createdIds.push(productId);

			expect(productId).toMatch(/^prod_/);
			expect(product.title).toBe(`${prefix} chair`);
			expect(product.status).toBe('draft');
			// The derived option axis is what makes a one-field create possible at all.
			expect(product.options).toHaveLength(1);
			expect(product.variants).toHaveLength(1);
			expect(product.variants[0].title).toBe('Default');
		});

		it('reads the product back by ID', async () => {
			const output = await run({ resource: 'product', operation: 'get', productId, options: {} });
			expect((output[0].json as Record<string, unknown>).id).toBe(productId);
		});

		it('expands relations when asked for them', async () => {
			const output = await run({
				resource: 'product',
				operation: 'get',
				productId,
				options: { fields: 'id,title,*variants' },
			});
			const product = output[0].json as unknown as ProductRecord;
			expect(product.variants).toBeInstanceOf(Array);
			expect(product.variants[0]).toHaveProperty('id');
		});

		it('updates the product with POST, which is how Medusa updates', async () => {
			const output = await run({
				resource: 'product',
				operation: 'update',
				productId,
				updateFields: { title: `${prefix} chair renamed`, status: 'published' },
			});
			const product = output[0].json as Record<string, unknown>;
			expect(product.title).toBe(`${prefix} chair renamed`);
			expect(product.status).toBe('published');
		});

		it('deletes the product and reports it deleted', async () => {
			const output = await run({ resource: 'product', operation: 'delete', productId });
			const result = output[0].json as Record<string, unknown>;
			expect(result.deleted).toBe(true);
			expect(result.id).toBe(productId);
			createdIds.splice(createdIds.indexOf(productId), 1);
		});

		it('reports a clear error when reading the deleted product', async () => {
			await expect(
				run({ resource: 'product', operation: 'get', productId, options: {} }),
			).rejects.toThrow(new RegExp(`product ${productId} was not found`));
		});
	});

	describe('listing', () => {
		it('returns many products and respects a limit', async () => {
			for (const name of ['alpha', 'beta', 'gamma']) {
				const output = await run({
					resource: 'product',
					operation: 'create',
					title: `${prefix} list ${name}`,
					variants: variant('Default', 10),
					additionalFields: {},
				});
				createdIds.push((output[0].json as Record<string, string>).id);
			}

			const limited = await run({
				resource: 'product',
				operation: 'getAll',
				returnAll: false,
				limit: 2,
				filters: { q: `${prefix} list` },
				options: {},
			});
			expect(limited).toHaveLength(2);

			const all = await run({
				resource: 'product',
				operation: 'getAll',
				returnAll: true,
				filters: { q: `${prefix} list` },
				options: { pageSize: 2 },
			});
			expect(all).toHaveLength(3);
		}, 120_000);

		it('filters by status', async () => {
			const output = await run({
				resource: 'product',
				operation: 'getAll',
				returnAll: true,
				filters: { q: `${prefix} list`, status: ['draft'] },
				options: {},
			});
			for (const item of output) {
				expect((item.json as Record<string, unknown>).status).toBe('draft');
			}
		});

		it('returns nothing for a filter that matches nothing', async () => {
			const output = await run({
				resource: 'product',
				operation: 'getAll',
				returnAll: true,
				filters: { q: 'definitely-no-such-product-xyz' },
				options: {},
			});
			expect(output).toEqual([]);
		});
	});

	describe('failure handling', () => {
		it('surfaces a validation failure using Medusa own wording', async () => {
			await expect(
				run({
					resource: 'product',
					operation: 'create',
					title: `${prefix} invalid`,
					variants: { variant: [] },
					additionalFields: {},
				}),
			).rejects.toThrow(/at least one variant/i);
		});

		it('rejects a base URL that already ends in /admin, before any request is sent', async () => {
			await expect(
				run(
					{ resource: 'product', operation: 'get', productId: 'prod_x', options: {} },
					{ credentials: { baseUrl: `${baseUrl}/admin` } },
				),
			).rejects.toThrow(/Remove the trailing "\/admin"/);
		});

		it('reports a rejected token as an authentication problem', async () => {
			await expect(
				run(
					{
						resource: 'product',
						operation: 'getAll',
						returnAll: false,
						limit: 1,
						filters: {},
						options: {},
					},
					{ credentials: { apiToken: 'sk_not_a_real_key' } },
				),
			).rejects.toThrow(/rejected the API token/i);
		});

		// Continue On Fail is what keeps one malformed row from discarding an entire catalog sync.
		it('reports per-item failures instead of losing the batch when Continue On Fail is set', async () => {
			const output = await run(
				{ resource: 'product', operation: 'get', productId: 'prod_does_not_exist', options: {} },
				{
					continueOnFail: true,
					items: [{ json: {} }, { json: {} }],
				},
			);

			expect(output).toHaveLength(2);
			for (const item of output) {
				expect((item.json as Record<string, string>).error).toMatch(/was not found/);
			}
		});
	});
});
