import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { routeOperations } from '../../nodes/Medusa/shared/router';
import { hasMedusa, medusaApiToken, medusaBaseUrl } from '../support/env.mjs';
import { createExecuteFunctions } from '../support/harness';

const describeMedusa = hasMedusa ? describe : describe.skip;
const baseUrl = String(medusaBaseUrl ?? '').replace(/\/+$/, '');
const prefix = `n8ninv${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
const cleanup: Array<{ path: string; id: string }> = [];

interface LevelRecord {
	id: string;
	location_id: string;
	stocked_quantity: number;
	incoming_quantity?: number;
}

async function run(parameters: Record<string, unknown>, extra: Record<string, unknown> = {}) {
	const context = createExecuteFunctions({ parameters, ...extra });
	const [output] = await routeOperations.call(context);
	return output;
}

describeMedusa('inventory and stock location operations against a live Medusa server', () => {
	let itemId: string;
	let locationId: string;

	beforeAll(async () => {
		const location = await run({
			resource: 'stockLocation',
			operation: 'create',
			name: `${prefix} warehouse`,
			additionalFields: {
				address: { address: { address_1: '1 Main St', city: 'Toledo', country_code: 'us' } },
			},
		});
		locationId = (location[0].json as Record<string, string>).id;
		cleanup.push({ path: 'stock-locations', id: locationId });

		const item = await run({
			resource: 'inventoryItem',
			operation: 'create',
			sku: `${prefix}-sku`,
			additionalFields: { title: `${prefix} widget` },
		});
		itemId = (item[0].json as Record<string, string>).id;
		cleanup.push({ path: 'inventory-items', id: itemId });
	}, 120_000);

	afterAll(async () => {
		for (const entry of cleanup.reverse()) {
			await fetch(`${baseUrl}/admin/${entry.path}/${entry.id}`, {
				method: 'DELETE',
				headers: { Authorization: `Basic ${medusaApiToken}` },
			});
		}
	}, 120_000);

	describe('stock location', () => {
		it('creates a location with a nested address', async () => {
			const output = await run({
				resource: 'stockLocation',
				operation: 'get',
				locationId,
				options: { fields: 'id,name,*address' },
			});
			const location = output[0].json as Record<string, unknown> & {
				address?: { city?: string };
			};
			expect(location.id).toBe(locationId);
			// The address arrives from a fixedCollection and has to be unwrapped before sending.
			expect(location.address?.city).toBe('Toledo');
		});

		it('lists locations and respects a limit', async () => {
			const output = await run({
				resource: 'stockLocation',
				operation: 'getAll',
				returnAll: false,
				limit: 1,
				filters: { q: prefix },
				options: {},
			});
			expect(output).toHaveLength(1);
		});

		it('updates the location', async () => {
			const output = await run({
				resource: 'stockLocation',
				operation: 'update',
				locationId,
				updateFields: { name: `${prefix} warehouse renamed` },
			});
			expect((output[0].json as Record<string, string>).name).toBe(`${prefix} warehouse renamed`);
		});

		it('adds and removes a sales channel', async () => {
			const created = (await fetch(`${baseUrl}/admin/sales-channels`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Basic ${medusaApiToken}`,
				},
				body: JSON.stringify({ name: `${prefix} channel` }),
			}).then((response) => response.json())) as { sales_channel: { id: string } };
			const channelId = created.sales_channel.id;
			cleanup.push({ path: 'sales-channels', id: channelId });

			await run({
				resource: 'stockLocation',
				operation: 'setSalesChannels',
				locationId,
				addChannelIds: channelId,
				removeChannelIds: '',
			});

			const withChannels = await run({
				resource: 'stockLocation',
				operation: 'get',
				locationId,
				options: { fields: 'id,*sales_channels' },
			});
			const channels =
				((withChannels[0].json as Record<string, unknown>).sales_channels as Array<{
					id: string;
				}>) ?? [];
			expect(channels.map((entry) => entry.id)).toContain(channelId);
		});
	});

	describe('inventory item', () => {
		it('finds the item by exact SKU', async () => {
			const output = await run({
				resource: 'inventoryItem',
				operation: 'getAll',
				returnAll: true,
				filters: { sku: `${prefix}-sku` },
				options: {},
			});
			expect(output).toHaveLength(1);
			expect((output[0].json as Record<string, string>).id).toBe(itemId);
		});

		it('updates the item', async () => {
			const output = await run({
				resource: 'inventoryItem',
				operation: 'update',
				itemId,
				updateFields: { title: `${prefix} widget renamed` },
			});
			expect((output[0].json as Record<string, string>).title).toBe(`${prefix} widget renamed`);
		});
	});

	describe('location levels', () => {
		// Set Location Level exists because Medusa splits create and update across two routes and a
		// warehouse feed does not know which case it is in. Both paths are exercised here.
		it('creates the level on first use', async () => {
			const output = await run({
				resource: 'inventoryItem',
				operation: 'setLevel',
				inventoryItemId: itemId,
				locationId,
				stockedQuantity: 25,
				additionalFields: {},
			});

			const level = output[0].json as unknown as LevelRecord;
			// Medusa answers with the parent inventory item; the level is what a workflow wants.
			expect(level.location_id).toBe(locationId);
			expect(level.stocked_quantity).toBe(25);
		});

		it('updates the same level on second use, rather than failing as a duplicate', async () => {
			const output = await run({
				resource: 'inventoryItem',
				operation: 'setLevel',
				inventoryItemId: itemId,
				locationId,
				stockedQuantity: 40,
				additionalFields: { incoming_quantity: 10 },
			});

			const level = output[0].json as unknown as LevelRecord;
			expect(level.stocked_quantity).toBe(40);
			expect(level.incoming_quantity).toBe(10);
		});

		it('reads the levels back', async () => {
			const output = await run({
				resource: 'inventoryItem',
				operation: 'getLevels',
				inventoryItemId: itemId,
				returnAll: true,
			});
			expect(output).toHaveLength(1);
			expect((output[0].json as unknown as LevelRecord).stocked_quantity).toBe(40);
		});

		// Medusa refuses to stop tracking a location that still holds stock. The message names the
		// location and is passed through unchanged.
		it('refuses to delete a level while stock remains, explaining why', async () => {
			await expect(
				run({
					resource: 'inventoryItem',
					operation: 'deleteLevel',
					inventoryItemId: itemId,
					locationId,
				}),
			).rejects.toThrow(/stocked items at the location/i);
		});

		it('deletes the level once the stock is zeroed', async () => {
			await run({
				resource: 'inventoryItem',
				operation: 'setLevel',
				inventoryItemId: itemId,
				locationId,
				stockedQuantity: 0,
				additionalFields: {},
			});

			const output = await run({
				resource: 'inventoryItem',
				operation: 'deleteLevel',
				inventoryItemId: itemId,
				locationId,
			});
			expect((output[0].json as Record<string, unknown>).deleted).toBe(true);
		});
	});
});
