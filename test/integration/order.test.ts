import { beforeAll, describe, expect, it } from 'vitest';
import { routeOperations } from '../../nodes/Medusa/shared/router';
import { hasMedusa, medusaApiToken, medusaBaseUrl } from '../support/env.mjs';
import { buildOrderFixture } from '../support/order-fixture.mjs';
import { createExecuteFunctions } from '../support/harness';

const describeMedusa = hasMedusa ? describe : describe.skip;
const baseUrl = String(medusaBaseUrl ?? '').replace(/\/+$/, '');
const prefix = `n8nord${Date.now()}${Math.random().toString(36).slice(2, 5)}`;

interface OrderRecord {
	id: string;
	status: string;
	email?: string;
	fulfillment_status?: string;
	items?: Array<{ id: string; quantity: number }>;
	metadata?: Record<string, unknown>;
}

async function run(parameters: Record<string, unknown>, extra: Record<string, unknown> = {}) {
	const context = createExecuteFunctions({ parameters, ...extra });
	const [output] = await routeOperations.call(context);
	return output;
}

describeMedusa('order and fulfillment operations against a live Medusa server', () => {
	let makeOrder: (n?: number) => Promise<OrderRecord>;

	beforeAll(async () => {
		const fixture = await buildOrderFixture(baseUrl, medusaApiToken, prefix);
		makeOrder = fixture.makeOrder as typeof makeOrder;
	}, 180_000);

	describe('reading', () => {
		it('reads an order by ID', async () => {
			const order = await makeOrder(1);
			const output = await run({
				resource: 'order',
				operation: 'get',
				orderId: order.id,
				options: {},
			});
			expect((output[0].json as unknown as OrderRecord).id).toBe(order.id);
		});

		// Orders include their items by default, but not every field: email is omitted unless it is
		// asked for by name, which is easy to mistake for the value being unset.
		it('returns items by default, and email only when requested', async () => {
			const order = await makeOrder(2);

			const plain = await run({
				resource: 'order',
				operation: 'get',
				orderId: order.id,
				options: {},
			});
			const plainOrder = plain[0].json as unknown as OrderRecord;
			expect(plainOrder.items?.length).toBeGreaterThan(0);
			expect(plainOrder.email).toBeUndefined();

			const withEmail = await run({
				resource: 'order',
				operation: 'get',
				orderId: order.id,
				options: { fields: 'id,email' },
			});
			expect((withEmail[0].json as unknown as OrderRecord).email).toContain('@example.com');
		});

		it('lists orders and respects a limit', async () => {
			const output = await run({
				resource: 'order',
				operation: 'getAll',
				returnAll: false,
				limit: 1,
				filters: {},
				options: {},
			});
			expect(output).toHaveLength(1);
		});

		it('filters by status', async () => {
			const output = await run({
				resource: 'order',
				operation: 'getAll',
				returnAll: true,
				limit: 0,
				filters: { status: ['pending'] },
				options: {},
			});
			for (const item of output) {
				expect((item.json as unknown as OrderRecord).status).toBe('pending');
			}
		});

		// The IDs this returns must be the ones Create Fulfillment accepts. Medusa's own
		// /line-items route returns versioned join records with orditem_ IDs, which fulfillment
		// rejects, so this asserts the shape a workflow can actually chain.
		it('returns line item IDs that fulfillment will accept', async () => {
			const order = await makeOrder(3);
			const output = await run({
				resource: 'order',
				operation: 'getLineItems',
				orderId: order.id,
			});
			expect(output.length).toBeGreaterThan(0);
			for (const item of output) {
				expect(String((item.json as Record<string, unknown>).id)).toMatch(/^ordli_/);
			}
		});

		it('names an order that was not found', async () => {
			await expect(
				run({ resource: 'order', operation: 'get', orderId: 'order_nope', options: {} }),
			).rejects.toThrow(/not found/i);
		});
	});

	describe('updating', () => {
		it('updates email and metadata', async () => {
			const order = await makeOrder(4);
			const output = await run({
				resource: 'order',
				operation: 'update',
				orderId: order.id,
				updateFields: { email: `changed-${prefix}@example.com`, metadata: '{"source":"n8n"}' },
			});
			expect((output[0].json as unknown as OrderRecord).metadata).toMatchObject({ source: 'n8n' });

			// The update response omits email, as every order read does unless it is requested.
			const reread = await run({
				resource: 'order',
				operation: 'get',
				orderId: order.id,
				options: { fields: 'id,email' },
			});
			expect((reread[0].json as unknown as OrderRecord).email).toBe(
				`changed-${prefix}@example.com`,
			);
		});
	});

	// Every transition below was established against a live server rather than read off the spec,
	// which is why they are separate operations instead of a writable status field: Medusa rejects
	// `status` in an update body outright, and each transition has preconditions only it can judge.
	describe('state transitions', () => {
		it('completes a pending order, and completing again is harmless', async () => {
			const order = await makeOrder(5);
			const first = await run({ resource: 'order', operation: 'complete', orderId: order.id });
			expect((first[0].json as unknown as OrderRecord).status).toBe('completed');

			const again = await run({ resource: 'order', operation: 'complete', orderId: order.id });
			expect((again[0].json as unknown as OrderRecord).status).toBe('completed');
		});

		it('refuses to cancel a completed order, and says to use returns instead', async () => {
			const order = await makeOrder(6);
			await run({ resource: 'order', operation: 'complete', orderId: order.id });

			await expect(
				run({ resource: 'order', operation: 'cancel', orderId: order.id }),
			).rejects.toThrow(/cannot cancel a completed order/i);
		});

		it('cancels a pending order, which also cancels its payment', async () => {
			const order = await makeOrder(7);
			const output = await run({ resource: 'order', operation: 'cancel', orderId: order.id });
			expect((output[0].json as unknown as OrderRecord).status).toBe('canceled');
		});

		it('refuses to complete a canceled order', async () => {
			const order = await makeOrder(8);
			await run({ resource: 'order', operation: 'cancel', orderId: order.id });

			await expect(
				run({ resource: 'order', operation: 'complete', orderId: order.id }),
			).rejects.toThrow(/canceled and cannot be completed/i);
		});

		it('archives an order from either terminal state', async () => {
			const completed = await makeOrder(9);
			await run({ resource: 'order', operation: 'complete', orderId: completed.id });
			const archivedFromComplete = await run({
				resource: 'order',
				operation: 'archive',
				orderId: completed.id,
			});
			expect((archivedFromComplete[0].json as unknown as OrderRecord).status).toBe('archived');

			const canceled = await makeOrder(10);
			await run({ resource: 'order', operation: 'cancel', orderId: canceled.id });
			const archivedFromCancel = await run({
				resource: 'order',
				operation: 'archive',
				orderId: canceled.id,
			});
			expect((archivedFromCancel[0].json as unknown as OrderRecord).status).toBe('archived');
		});
	});

	describe('fulfillment', () => {
		it('fulfills items and returns the fulfillment rather than the order', async () => {
			const order = await makeOrder(11);
			const items = await run({
				resource: 'order',
				operation: 'getLineItems',
				orderId: order.id,
			});
			const lineItemId = (items[0].json as Record<string, string>).id;

			const output = await run({
				resource: 'fulfillment',
				operation: 'create',
				orderId: order.id,
				items: { item: [{ id: lineItemId, quantity: 1 }] },
				additionalFields: {},
			});

			// Medusa answers with the order, and does not expand fulfillments in that response, so
			// this proves the order is read back to find the fulfillment just created.
			const fulfillment = output[0].json as Record<string, unknown>;
			expect(String(fulfillment.id)).toMatch(/^ful_/);
		});

		it('lists an order fulfillments, which has no route of its own', async () => {
			const order = await makeOrder(12);
			const items = await run({
				resource: 'order',
				operation: 'getLineItems',
				orderId: order.id,
			});
			await run({
				resource: 'fulfillment',
				operation: 'create',
				orderId: order.id,
				items: { item: [{ id: (items[0].json as Record<string, string>).id, quantity: 1 }] },
				additionalFields: {},
			});

			const output = await run({ resource: 'fulfillment', operation: 'getAll', orderId: order.id });
			expect(output).toHaveLength(1);
			expect(String((output[0].json as Record<string, unknown>).id)).toMatch(/^ful_/);
		});

		it('ships, then delivers, then refuses to cancel what has shipped', async () => {
			const order = await makeOrder(13);
			const items = await run({
				resource: 'order',
				operation: 'getLineItems',
				orderId: order.id,
			});
			const lineItemId = (items[0].json as Record<string, string>).id;

			const created = await run({
				resource: 'fulfillment',
				operation: 'create',
				orderId: order.id,
				items: { item: [{ id: lineItemId, quantity: 1 }] },
				additionalFields: {},
			});
			const fulfillmentId = String((created[0].json as Record<string, unknown>).id);

			await run({
				resource: 'fulfillment',
				operation: 'createShipment',
				orderId: order.id,
				fulfillmentId,
				items: { item: [{ id: lineItemId, quantity: 1 }] },
			});

			await run({
				resource: 'fulfillment',
				operation: 'markDelivered',
				orderId: order.id,
				fulfillmentId,
			});

			await expect(
				run({ resource: 'fulfillment', operation: 'cancel', orderId: order.id, fulfillmentId }),
			).rejects.toThrow(/shipped fulfillments cannot be canceled/i);
		});

		it('cancels an unshipped fulfillment, which then allows cancelling the order', async () => {
			const order = await makeOrder(14);
			const items = await run({
				resource: 'order',
				operation: 'getLineItems',
				orderId: order.id,
			});
			const lineItemId = (items[0].json as Record<string, string>).id;

			const created = await run({
				resource: 'fulfillment',
				operation: 'create',
				orderId: order.id,
				items: { item: [{ id: lineItemId, quantity: 1 }] },
				additionalFields: {},
			});
			const fulfillmentId = String((created[0].json as Record<string, unknown>).id);

			// Medusa refuses to cancel an order while any fulfillment is still active.
			await expect(
				run({ resource: 'order', operation: 'cancel', orderId: order.id }),
			).rejects.toThrow(/all fulfillments must be canceled/i);

			await run({ resource: 'fulfillment', operation: 'cancel', orderId: order.id, fulfillmentId });

			const canceled = await run({ resource: 'order', operation: 'cancel', orderId: order.id });
			expect((canceled[0].json as unknown as OrderRecord).status).toBe('canceled');
		});

		it('rejects a fulfillment with no items before sending the request', async () => {
			const order = await makeOrder(15);
			await expect(
				run({
					resource: 'fulfillment',
					operation: 'create',
					orderId: order.id,
					items: { item: [] },
					additionalFields: {},
				}),
			).rejects.toThrow(/at least one item/i);
		});
	});
});
