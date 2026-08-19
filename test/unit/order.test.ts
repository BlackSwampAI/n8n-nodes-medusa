import { describe, expect, it } from 'vitest';
import { Medusa } from '../../nodes/Medusa/Medusa.node';
import { buildFulfillmentItems } from '../../nodes/Medusa/resources/fulfillment';
import { orderDescription, orderOperations } from '../../nodes/Medusa/resources/order';
import {
	fulfillmentDescription,
	fulfillmentOperations,
} from '../../nodes/Medusa/resources/fulfillment';

describe('buildFulfillmentItems', () => {
	it('maps the collection into the array Medusa expects', () => {
		expect(
			buildFulfillmentItems({
				item: [
					{ id: 'ordli_1', quantity: 2 },
					{ id: 'ordli_2', quantity: 1 },
				],
			}),
		).toEqual([
			{ id: 'ordli_1', quantity: 2 },
			{ id: 'ordli_2', quantity: 1 },
		]);
	});

	it('defaults a missing quantity to one', () => {
		expect(buildFulfillmentItems({ item: [{ id: 'ordli_1' }] })).toEqual([
			{ id: 'ordli_1', quantity: 1 },
		]);
	});

	it('drops rows with no line item, which an empty UI row produces', () => {
		expect(buildFulfillmentItems({ item: [{ quantity: 3 }] })).toEqual([]);
		expect(buildFulfillmentItems({})).toEqual([]);
	});
});

describe('order resource', () => {
	it('offers exactly the operations it implements', () => {
		const selector = orderDescription.find((field) => field.name === 'operation');
		const offered = (selector?.options ?? [])
			.map((option) => (option as { value: string }).value)
			.sort();
		expect(offered).toEqual([
			'archive',
			'cancel',
			'complete',
			'get',
			'getAll',
			'getChanges',
			'getLineItems',
			'update',
		]);
		expect(Object.keys(orderOperations).sort()).toEqual(offered);
	});

	// Medusa rejects `status` in an update body outright, so exposing it as an editable field
	// would produce a request that always fails. Transitions are their own operations instead.
	it('does not offer status as an editable field', () => {
		const updateFields = orderDescription.find((field) => field.name === 'updateFields');
		const names = (updateFields?.options ?? []).map((option) => (option as { name: string }).name);
		expect(names).not.toContain('status');
	});

	it('offers no create or delete, which the API does not have', () => {
		expect(orderOperations.create).toBeUndefined();
		expect(orderOperations.delete).toBeUndefined();
	});
});

describe('fulfillment resource', () => {
	it('offers exactly the operations it implements', () => {
		const selector = fulfillmentDescription.find((field) => field.name === 'operation');
		const offered = (selector?.options ?? [])
			.map((option) => (option as { value: string }).value)
			.sort();
		expect(offered).toEqual(['cancel', 'create', 'createShipment', 'getAll', 'markDelivered']);
		expect(Object.keys(fulfillmentOperations).sort()).toEqual(offered);
	});

	it('requires an order ID on every operation, since none is addressable on its own', () => {
		const orderIdFields = fulfillmentDescription.filter((field) => field.name === 'orderId');
		const covered = new Set(orderIdFields.flatMap((f) => f.displayOptions?.show?.operation ?? []));
		expect([...covered].sort()).toEqual([
			'cancel',
			'create',
			'createShipment',
			'getAll',
			'markDelivered',
		]);
	});
});

// A field bound to an operation that does not exist never renders, and nothing else catches it:
// lint checks the shape of a field, typecheck checks its types, and the tests above check that
// handlers and menu entries agree. None of them notice `operation: ['getAl']`.
describe('field bindings across the whole node', () => {
	const properties = new Medusa().description.properties;
	const resources = (
		properties.find((property) => property.name === 'resource')?.options ?? []
	).map((option) => (option as { value: string }).value);

	const operationsByResource = new Map<string, Set<string>>();
	for (const property of properties) {
		if (property.name !== 'operation') continue;
		for (const resource of property.displayOptions?.show?.resource ?? []) {
			operationsByResource.set(
				String(resource),
				new Set((property.options ?? []).map((option) => (option as { value: string }).value)),
			);
		}
	}

	it('declares an operation menu for every resource', () => {
		expect([...operationsByResource.keys()].sort()).toEqual([...resources].sort());
	});

	it('binds every field to a resource that exists', () => {
		for (const property of properties) {
			for (const resource of property.displayOptions?.show?.resource ?? []) {
				expect(
					resources,
					`field "${property.name}" binds to unknown resource ${resource}`,
				).toContain(resource);
			}
		}
	});

	it('binds every field to an operation that exists on that resource', () => {
		for (const property of properties) {
			const show = property.displayOptions?.show;
			if (!show?.resource || !show?.operation) continue;

			for (const resource of show.resource) {
				const known = operationsByResource.get(String(resource));
				for (const operation of show.operation) {
					expect(
						known?.has(String(operation)),
						`field "${property.name}" binds to ${resource}.${operation}, which does not exist`,
					).toBe(true);
				}
			}
		}
	});
});
