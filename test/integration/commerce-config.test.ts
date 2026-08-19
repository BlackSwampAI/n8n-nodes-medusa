import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { routeOperations } from '../../nodes/Medusa/shared/router';
import { hasMedusa, medusaApiToken, medusaBaseUrl } from '../support/env.mjs';
import { createExecuteFunctions } from '../support/harness';

const describeMedusa = hasMedusa ? describe : describe.skip;
const baseUrl = String(medusaBaseUrl ?? '').replace(/\/+$/, '');
const prefix = `n8ncfg${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
const cleanup: Array<{ path: string; id: string }> = [];

async function run(parameters: Record<string, unknown>, extra: Record<string, unknown> = {}) {
	const context = createExecuteFunctions({ parameters, ...extra });
	const [output] = await routeOperations.call(context);
	return output;
}

function record(output: Array<{ json: unknown }>) {
	return output[0].json as Record<string, unknown>;
}

describeMedusa('commerce configuration against a live Medusa server', () => {
	let productId: string;
	let variantId: string;

	beforeAll(async () => {
		const product = await run({
			resource: 'product',
			operation: 'create',
			title: `${prefix} widget`,
			variants: { variant: [{ title: 'Default', currencyCode: 'usd', amount: 20 }] },
			additionalFields: {},
		});
		productId = String(record(product).id);
		cleanup.push({ path: 'products', id: productId });

		const withVariants = await run({
			resource: 'product',
			operation: 'get',
			productId,
			options: { fields: 'id,*variants' },
		});
		variantId = String((record(withVariants).variants as Array<{ id: string }>)[0].id);
	}, 120_000);

	afterAll(async () => {
		for (const entry of cleanup.reverse()) {
			await fetch(`${baseUrl}/admin/${entry.path}/${entry.id}`, {
				method: 'DELETE',
				headers: { Authorization: `Basic ${medusaApiToken}` },
			});
		}
	}, 120_000);

	describe('sales channel', () => {
		let channelId: string;

		it('creates, reads and updates a channel', async () => {
			const created = await run({
				resource: 'salesChannel',
				operation: 'create',
				name: `${prefix} channel`,
				additionalFields: { description: 'created by tests' },
			});
			channelId = String(record(created).id);
			cleanup.push({ path: 'sales-channels', id: channelId });
			expect(record(created).name).toBe(`${prefix} channel`);

			const updated = await run({
				resource: 'salesChannel',
				operation: 'update',
				channelId,
				updateFields: { description: 'updated' },
			});
			expect(record(updated).description).toBe('updated');
		});

		// The membership is only readable from the product side: a sales channel exposes no
		// products relation at all, and expanding *products on it returns nothing even when the
		// assignment succeeded. Checking the channel would have looked like a failed write.
		it('adds and removes products', async () => {
			await run({
				resource: 'salesChannel',
				operation: 'addProducts',
				channelId,
				addProductIds: productId,
				removeProductIds: '',
			});

			const added = await run({
				resource: 'product',
				operation: 'get',
				productId,
				options: { fields: 'id,*sales_channels' },
			});
			const channels = (record(added).sales_channels as Array<{ id: string }>) ?? [];
			expect(channels.map((entry) => entry.id)).toContain(channelId);

			await run({
				resource: 'salesChannel',
				operation: 'addProducts',
				channelId,
				addProductIds: '',
				removeProductIds: productId,
			});

			const removed = await run({
				resource: 'product',
				operation: 'get',
				productId,
				options: { fields: 'id,*sales_channels' },
			});
			const remaining = (record(removed).sales_channels as Array<{ id: string }>) ?? [];
			expect(remaining.map((entry) => entry.id)).not.toContain(channelId);
		});
	});

	describe('region', () => {
		let regionId: string;

		it('creates a region without countries', async () => {
			const created = await run({
				resource: 'region',
				operation: 'create',
				name: `${prefix} region`,
				currency_code: 'EUR',
				additionalFields: {},
			});
			regionId = String(record(created).id);
			cleanup.push({ path: 'regions', id: regionId });

			// The currency is lowercased on the way out, since Medusa stores it that way.
			expect(record(created).currency_code).toBe('eur');
		});

		it('splits a comma-separated country list into an array', async () => {
			const created = await run({
				resource: 'region',
				operation: 'create',
				name: `${prefix} region 2`,
				currency_code: 'gbp',
				additionalFields: { countries: ' gb , je ' },
			});
			const id = String(record(created).id);
			cleanup.push({ path: 'regions', id });

			const read = await run({
				resource: 'region',
				operation: 'get',
				regionId: id,
				options: { fields: 'id,*countries' },
			});
			const codes = ((record(read).countries as Array<{ iso_2: string }>) ?? []).map(
				(country) => country.iso_2,
			);
			expect(codes.sort()).toEqual(['gb', 'je']);
		});

		// A country belongs to exactly one region, which is the most likely failure when scripting
		// region setup. Medusa's message names the offending codes, so it passes through unchanged.
		it('reports the country collision clearly', async () => {
			await expect(
				run({
					resource: 'region',
					operation: 'create',
					name: `${prefix} clash`,
					currency_code: 'gbp',
					additionalFields: { countries: 'gb' },
				}),
			).rejects.toThrow(/already assigned to a region/i);
		});
	});

	describe('price list', () => {
		let priceListId: string;

		it('creates a price list, which requires a description as well as a title', async () => {
			const created = await run({
				resource: 'priceList',
				operation: 'create',
				title: `${prefix} sale`,
				description: 'created by tests',
				additionalFields: { type: 'sale', status: 'active' },
			});
			priceListId = String(record(created).id);
			cleanup.push({ path: 'price-lists', id: priceListId });
			expect(record(created).status).toBe('active');
		});

		it('adds prices and reads them back', async () => {
			await run({
				resource: 'priceList',
				operation: 'addPrices',
				priceListId,
				prices: { price: [{ variant_id: variantId, currency_code: 'USD', amount: 12.5 }] },
			});

			const prices = await run({
				resource: 'priceList',
				operation: 'getPrices',
				priceListId,
				returnAll: true,
			});
			expect(prices).toHaveLength(1);
			expect(record(prices).amount).toBe(12.5);
			expect(record(prices).currency_code).toBe('usd');
		});

		it('rejects an empty price list update before sending it', async () => {
			await expect(
				run({
					resource: 'priceList',
					operation: 'addPrices',
					priceListId,
					prices: { price: [] },
				}),
			).rejects.toThrow(/at least one price/i);
		});
	});

	describe('promotion', () => {
		it('creates a percentage promotion spread across items', async () => {
			const created = await run({
				resource: 'promotion',
				operation: 'create',
				code: `${prefix}-PCT`,
				methodType: 'percentage',
				methodValue: 10,
				targetType: 'items',
				allocation: 'across',
				maxQuantity: 1,
				additionalFields: { status: 'active' },
			});
			const id = String(record(created).id);
			cleanup.push({ path: 'promotions', id });
			expect(record(created).code).toBe(`${prefix}-PCT`);
			expect(record(created).status).toBe('active');
		});

		// Medusa rejects an "each" allocation that does not carry max_quantity, which is why the
		// node sends one automatically rather than leaving it to the user to discover.
		it('creates an each-allocation promotion, supplying the max quantity Medusa demands', async () => {
			const created = await run({
				resource: 'promotion',
				operation: 'create',
				code: `${prefix}-EACH`,
				methodType: 'percentage',
				methodValue: 5,
				targetType: 'items',
				allocation: 'each',
				maxQuantity: 2,
				additionalFields: {},
			});
			cleanup.push({ path: 'promotions', id: String(record(created).id) });
			expect(record(created).code).toBe(`${prefix}-EACH`);
		});

		it('refuses a fixed-amount promotion with no currency, before sending the request', async () => {
			await expect(
				run({
					resource: 'promotion',
					operation: 'create',
					code: `${prefix}-BAD`,
					methodType: 'fixed',
					methodValue: 5,
					targetType: 'order',
					allocation: 'across',
					maxQuantity: 1,
					additionalFields: {},
				}),
			).rejects.toThrow(/currency code is required/i);
		});

		it('finds a promotion by exact code', async () => {
			const output = await run({
				resource: 'promotion',
				operation: 'getAll',
				returnAll: true,
				filters: { code: `${prefix}-PCT` },
				options: {},
			});
			expect(output).toHaveLength(1);
		});
	});
});
