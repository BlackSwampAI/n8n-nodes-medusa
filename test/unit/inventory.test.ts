import { describe, expect, it, vi } from 'vitest';
import type { IExecuteFunctions } from 'n8n-workflow';
import { setLocationLevel } from '../../nodes/Medusa/resources/inventoryItem/levels';
import {
	inventoryItemDescription,
	inventoryItemOperations,
} from '../../nodes/Medusa/resources/inventoryItem';
import {
	stockLocationDescription,
	stockLocationOperations,
} from '../../nodes/Medusa/resources/stockLocation';

/** Records the requests a handler makes, and replies with whatever the test queues up. */
function contextWith(parameters: Record<string, unknown>, replies: unknown[]) {
	const sent: Array<{ method: string; url: string; body: unknown }> = [];
	let call = 0;

	const context = {
		getNode: () => ({ name: 'Medusa' }),
		getNodeParameter: (name: string, _index: number, fallback?: unknown) =>
			name in parameters ? parameters[name] : fallback,
		getCredentials: async () => ({ baseUrl: 'https://example.com', apiToken: 'sk_test' }),
		helpers: {
			httpRequestWithAuthentication: vi.fn(async (_credential: string, request: never) => {
				const typed = request as unknown as { method: string; url: string; body: unknown };
				sent.push({ method: typed.method, url: typed.url, body: typed.body });
				return replies[call++];
			}),
		},
	} as unknown as IExecuteFunctions;

	return { context, sent };
}

const parameters = {
	inventoryItemId: 'iitem_1',
	locationId: 'sloc_1',
	stockedQuantity: 12,
	additionalFields: {},
};

// Medusa splits this across two routes: POST .../location-levels creates, and
// POST .../location-levels/{location_id} updates. Creating one that already exists fails, and a
// warehouse feed does not know which case it is in.
describe('setLocationLevel', () => {
	it('creates the level when the location is not tracked yet', async () => {
		const { context, sent } = contextWith(parameters, [
			{ inventory_levels: [] },
			{
				inventory_item: {
					id: 'iitem_1',
					location_levels: [{ id: 'ilev_1', location_id: 'sloc_1', stocked_quantity: 12 }],
				},
			},
		]);

		const level = await setLocationLevel.call(context, 0);

		expect(sent[1].method).toBe('POST');
		expect(sent[1].url).toBe('https://example.com/admin/inventory-items/iitem_1/location-levels');
		expect(sent[1].body).toMatchObject({ location_id: 'sloc_1', stocked_quantity: 12 });
		expect(level).toMatchObject({ id: 'ilev_1' });
	});

	it('updates the existing level instead of creating a duplicate', async () => {
		const { context, sent } = contextWith(parameters, [
			{ inventory_levels: [{ id: 'ilev_1', location_id: 'sloc_1' }] },
			{
				inventory_item: {
					id: 'iitem_1',
					location_levels: [{ id: 'ilev_1', location_id: 'sloc_1', stocked_quantity: 12 }],
				},
			},
		]);

		await setLocationLevel.call(context, 0);

		expect(sent[1].url).toBe(
			'https://example.com/admin/inventory-items/iitem_1/location-levels/sloc_1',
		);
		// The update route takes the location from the path, not the body.
		expect(sent[1].body).not.toHaveProperty('location_id');
	});

	it('ignores levels belonging to a different location', async () => {
		const { context, sent } = contextWith(parameters, [
			{ inventory_levels: [{ id: 'ilev_other', location_id: 'sloc_other' }] },
			{ inventory_item: { id: 'iitem_1', location_levels: [] } },
		]);

		await setLocationLevel.call(context, 0);

		expect(sent[1].url).toBe('https://example.com/admin/inventory-items/iitem_1/location-levels');
	});

	// Both routes answer with the parent inventory item rather than the level that changed.
	it('returns the level rather than the whole inventory item', async () => {
		const { context } = contextWith(parameters, [
			{ inventory_levels: [] },
			{
				inventory_item: {
					id: 'iitem_1',
					sku: 'WIDGET',
					location_levels: [
						{ id: 'ilev_other', location_id: 'sloc_other' },
						{ id: 'ilev_1', location_id: 'sloc_1', stocked_quantity: 12 },
					],
				},
			},
		]);

		const level = await setLocationLevel.call(context, 0);
		expect(level).toMatchObject({ id: 'ilev_1', location_id: 'sloc_1' });
		expect(level).not.toHaveProperty('sku');
	});
});

describe('inventory and stock location wiring', () => {
	it('inventory item offers exactly the operations it implements', () => {
		const selector = inventoryItemDescription.find((field) => field.name === 'operation');
		const offered = (selector?.options ?? [])
			.map((option) => (option as { value: string }).value)
			.sort();
		expect(offered).toEqual([
			'create',
			'delete',
			'deleteLevel',
			'get',
			'getAll',
			'getLevels',
			'setLevel',
			'update',
		]);
		expect(Object.keys(inventoryItemOperations).sort()).toEqual(offered);
	});

	it('stock location offers exactly the operations it implements', () => {
		const selector = stockLocationDescription.find((field) => field.name === 'operation');
		const offered = (selector?.options ?? [])
			.map((option) => (option as { value: string }).value)
			.sort();
		expect(offered).toEqual(['create', 'delete', 'get', 'getAll', 'setSalesChannels', 'update']);
		expect(Object.keys(stockLocationOperations).sort()).toEqual(offered);
	});

	// Medusa accepts an inventory item with no fields at all, exactly as it does for customers.
	it('requires a SKU even though the API does not', () => {
		const sku = inventoryItemDescription.find(
			(field) => field.name === 'sku' && field.displayOptions?.show?.operation?.includes('create'),
		);
		expect(sku?.required).toBe(true);
	});

	for (const [label, description, resource] of [
		['inventory item', inventoryItemDescription, 'inventoryItem'],
		['stock location', stockLocationDescription, 'stockLocation'],
	] as const) {
		it(`${label} binds every field to its own resource`, () => {
			for (const field of description) {
				if (field.name === 'operation') continue;
				expect(field.displayOptions?.show?.resource, `${field.name} is unbound`).toEqual([
					resource,
				]);
			}
		});
	}
});
