import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { routeOperations } from '../../nodes/Medusa/shared/router';
import { hasMedusa, medusaApiToken, medusaBaseUrl } from '../support/env.mjs';
import { createExecuteFunctions } from '../support/harness';

const describeMedusa = hasMedusa ? describe : describe.skip;
const baseUrl = String(medusaBaseUrl ?? '').replace(/\/+$/, '');
const prefix = `n8n-var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createdProductIds: string[] = [];

interface VariantRecord {
	id: string;
	title: string;
	sku?: string;
	prices?: Array<{ amount: number; currency_code: string }>;
}

async function run(parameters: Record<string, unknown>, extra: Record<string, unknown> = {}) {
	const context = createExecuteFunctions({ parameters, ...extra });
	const [output] = await routeOperations.call(context);
	return output;
}

/** Creates a product with a Size axis declaring the values the variant tests need. */
async function createProductWithSizes(title: string, values: string[]) {
	const output = await run({
		resource: 'product',
		operation: 'create',
		title,
		variants: { variant: [{ title: values[0], currencyCode: 'usd', amount: 10 }] },
		additionalFields: {
			optionsJson: JSON.stringify([{ title: 'Size', values }]),
			variantOptionsJson: JSON.stringify([{ Size: values[0] }]),
		},
	});
	const product = output[0].json as unknown as { id: string };
	createdProductIds.push(product.id);
	return product.id;
}

describeMedusa('product variant operations against a live Medusa server', () => {
	let productId: string;

	beforeAll(async () => {
		productId = await createProductWithSizes(`${prefix} shirt`, ['Small', 'Large', 'Huge']);
	}, 120_000);

	afterAll(async () => {
		for (const id of createdProductIds) {
			await fetch(`${baseUrl}/admin/products/${id}`, {
				method: 'DELETE',
				headers: { Authorization: `Basic ${medusaApiToken}` },
			});
		}
	}, 120_000);

	describe('the full lifecycle', () => {
		let variantId: string;

		it('creates a variant on an existing product', async () => {
			const output = await run({
				resource: 'productVariant',
				operation: 'create',
				productId,
				title: 'Large',
				prices: { price: [{ currencyCode: 'usd', amount: 24.5 }] },
				optionValues: { optionValue: [{ name: 'Size', value: 'Large' }] },
				additionalFields: { sku: `${prefix}-large` },
			});

			const variant = output[0].json as unknown as VariantRecord;
			variantId = variant.id;

			// Medusa answers a create with the whole product, so this asserts the variant was picked
			// back out of it rather than the product being returned.
			expect(variantId).toMatch(/^variant_/);
			expect(variant.title).toBe('Large');
			expect(variant.sku).toBe(`${prefix}-large`);
		});

		it('reads the variant back by ID', async () => {
			const output = await run({
				resource: 'productVariant',
				operation: 'get',
				productId,
				variantId,
				options: {},
			});
			expect((output[0].json as unknown as VariantRecord).id).toBe(variantId);
		});

		it('updates the variant and returns the variant, not the product', async () => {
			const output = await run({
				resource: 'productVariant',
				operation: 'update',
				productId,
				variantId,
				updateFields: { title: 'Large renamed', sku: `${prefix}-large-2` },
			});

			const variant = output[0].json as unknown as VariantRecord;
			expect(variant.id).toBe(variantId);
			expect(variant.title).toBe('Large renamed');
		});

		it('deletes the variant', async () => {
			const output = await run({
				resource: 'productVariant',
				operation: 'delete',
				productId,
				variantId,
			});
			const result = output[0].json as Record<string, unknown>;
			expect(result.deleted).toBe(true);
			expect(result.id).toBe(variantId);
		});
	});

	describe('listing', () => {
		it('lists the variants of one product through the nested route', async () => {
			const output = await run({
				resource: 'productVariant',
				operation: 'getAll',
				productId,
				returnAll: true,
				filters: {},
				options: {},
			});
			expect(output.length).toBeGreaterThanOrEqual(1);
			for (const item of output) {
				expect((item.json as unknown as VariantRecord).id).toMatch(/^variant_/);
			}
		});

		it('searches variants across every product when no product is given', async () => {
			const output = await run({
				resource: 'productVariant',
				operation: 'getAll',
				productId: '',
				returnAll: true,
				filters: { q: prefix },
				options: {},
			});
			expect(output.length).toBeGreaterThanOrEqual(1);
		});

		it('respects a limit', async () => {
			await run({
				resource: 'productVariant',
				operation: 'create',
				productId,
				title: 'Huge',
				prices: { price: [{ currencyCode: 'usd', amount: 30 }] },
				optionValues: { optionValue: [{ name: 'Size', value: 'Huge' }] },
				additionalFields: {},
			});

			const output = await run({
				resource: 'productVariant',
				operation: 'getAll',
				productId,
				returnAll: false,
				limit: 1,
				filters: {},
				options: {},
			});
			expect(output).toHaveLength(1);
		});
	});

	describe('failure handling', () => {
		// Medusa will not invent an option value, so this is a real constraint the UI documents
		// rather than something the node can paper over.
		it("reports Medusa's own message when the option value does not exist on the product", async () => {
			await expect(
				run({
					resource: 'productVariant',
					operation: 'create',
					productId,
					title: 'Enormous',
					prices: { price: [{ currencyCode: 'usd', amount: 40 }] },
					optionValues: { optionValue: [{ name: 'Size', value: 'Enormous' }] },
					additionalFields: {},
				}),
			).rejects.toThrow(/Option value Enormous does not exist for option Size/);
		});

		it('rejects a variant with no price before sending the request', async () => {
			await expect(
				run({
					resource: 'productVariant',
					operation: 'create',
					productId,
					title: 'Priceless',
					prices: { price: [] },
					optionValues: {},
					additionalFields: {},
				}),
			).rejects.toThrow(/at least one price/i);
		});

		// Medusa answers 200 with an empty body here rather than 404, so without handling this the
		// node would emit an empty item and the workflow would treat a failed read as a success.
		it('reports a variant that does not exist, despite Medusa answering 200', async () => {
			await expect(
				run({
					resource: 'productVariant',
					operation: 'get',
					productId,
					variantId: 'variant_does_not_exist',
					options: {},
				}),
			).rejects.toThrow(/variant_does_not_exist was not found/);
		});
	});
});
