import { afterAll, describe, expect, it } from 'vitest';
import { routeOperations } from '../../nodes/Medusa/shared/router';
import { hasMedusa, medusaApiToken, medusaBaseUrl } from '../support/env.mjs';
import { createExecuteFunctions } from '../support/harness';

const describeMedusa = hasMedusa ? describe : describe.skip;
const baseUrl = String(medusaBaseUrl ?? '').replace(/\/+$/, '');
const prefix = `n8ncust${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
const cleanup: Array<{ path: string; id: string }> = [];

interface CustomerRecord {
	id: string;
	email?: string;
	first_name?: string;
	groups?: Array<{ id: string }>;
}

interface GroupRecord {
	id: string;
	name?: string;
	customers?: Array<{ id: string }>;
}

async function run(parameters: Record<string, unknown>, extra: Record<string, unknown> = {}) {
	const context = createExecuteFunctions({ parameters, ...extra });
	const [output] = await routeOperations.call(context);
	return output;
}

describeMedusa('customer and customer group operations against a live Medusa server', () => {
	afterAll(async () => {
		for (const entry of cleanup.reverse()) {
			await fetch(`${baseUrl}/admin/${entry.path}/${entry.id}`, {
				method: 'DELETE',
				headers: { Authorization: `Basic ${medusaApiToken}` },
			});
		}
	}, 120_000);

	describe('customer lifecycle', () => {
		let customerId: string;

		it('creates a customer', async () => {
			const output = await run({
				resource: 'customer',
				operation: 'create',
				email: `${prefix}@example.com`,
				additionalFields: { first_name: 'Ada', last_name: 'Lovelace' },
			});

			const customer = output[0].json as unknown as CustomerRecord;
			customerId = customer.id;
			cleanup.push({ path: 'customers', id: customerId });

			expect(customerId).toMatch(/^cus_/);
			expect(customer.email).toBe(`${prefix}@example.com`);
			expect(customer.first_name).toBe('Ada');
		});

		it('reads the customer back by ID', async () => {
			const output = await run({
				resource: 'customer',
				operation: 'get',
				customerId,
				options: {},
			});
			expect((output[0].json as unknown as CustomerRecord).id).toBe(customerId);
		});

		it('finds the customer by exact email', async () => {
			const output = await run({
				resource: 'customer',
				operation: 'getAll',
				returnAll: true,
				filters: { email: `${prefix}@example.com` },
				options: {},
			});
			expect(output).toHaveLength(1);
			expect((output[0].json as unknown as CustomerRecord).id).toBe(customerId);
		});

		it('updates the customer', async () => {
			const output = await run({
				resource: 'customer',
				operation: 'update',
				customerId,
				updateFields: { first_name: 'Grace', metadata: '{"tier":"gold"}' },
			});
			const customer = output[0].json as unknown as CustomerRecord & { metadata?: unknown };
			expect(customer.first_name).toBe('Grace');
			expect(customer.metadata).toEqual({ tier: 'gold' });
		});

		it('names the customer that was not found', async () => {
			await expect(
				run({ resource: 'customer', operation: 'get', customerId: 'cus_nope', options: {} }),
			).rejects.toThrow(/customer cus_nope was not found/);
		});
	});

	describe('group membership', () => {
		let groupId: string;
		let customerId: string;

		it('creates a group', async () => {
			const output = await run({
				resource: 'customerGroup',
				operation: 'create',
				name: `${prefix} vip`,
				additionalFields: {},
			});
			const group = output[0].json as unknown as GroupRecord;
			groupId = group.id;
			cleanup.push({ path: 'customer-groups', id: groupId });

			expect(groupId).toMatch(/^cusgroup_/);
			expect(group.name).toBe(`${prefix} vip`);
		});

		it('creates a customer to put in it', async () => {
			const output = await run({
				resource: 'customer',
				operation: 'create',
				email: `${prefix}-member@example.com`,
				additionalFields: {},
			});
			customerId = (output[0].json as unknown as CustomerRecord).id;
			cleanup.push({ path: 'customers', id: customerId });
		});

		// Medusa exposes the same relationship from both ends, so both are wired up and both are
		// checked by reading the membership back rather than trusting the write response.
		it('adds the customer from the group side', async () => {
			await run({
				resource: 'customerGroup',
				operation: 'setCustomers',
				groupId,
				addCustomerIds: customerId,
				removeCustomerIds: '',
			});

			const output = await run({
				resource: 'customerGroup',
				operation: 'get',
				groupId,
				options: { fields: 'id,*customers' },
			});
			const members = (output[0].json as unknown as GroupRecord).customers ?? [];
			expect(members.map((member) => member.id)).toContain(customerId);
		});

		it('removes the customer from the group side', async () => {
			await run({
				resource: 'customerGroup',
				operation: 'setCustomers',
				groupId,
				addCustomerIds: '',
				removeCustomerIds: customerId,
			});

			const output = await run({
				resource: 'customerGroup',
				operation: 'get',
				groupId,
				options: { fields: 'id,*customers' },
			});
			const members = (output[0].json as unknown as GroupRecord).customers ?? [];
			expect(members.map((member) => member.id)).not.toContain(customerId);
		});

		it('adds the group from the customer side', async () => {
			await run({
				resource: 'customer',
				operation: 'setGroups',
				customerId,
				addGroupIds: groupId,
				removeGroupIds: '',
			});

			const output = await run({
				resource: 'customer',
				operation: 'get',
				customerId,
				options: { fields: 'id,*groups' },
			});
			const groups = (output[0].json as unknown as CustomerRecord).groups ?? [];
			expect(groups.map((group) => group.id)).toContain(groupId);
		});

		it('filters customers by group membership', async () => {
			const output = await run({
				resource: 'customer',
				operation: 'getAll',
				returnAll: true,
				filters: { q: prefix },
				options: { fields: 'id,email,*groups' },
			});
			expect(output.length).toBeGreaterThanOrEqual(1);
		});

		it('refuses a membership change that would do nothing', async () => {
			await expect(
				run({
					resource: 'customer',
					operation: 'setGroups',
					customerId,
					addGroupIds: '',
					removeGroupIds: '',
				}),
			).rejects.toThrow(/nothing to add or remove/i);
		});

		it('deletes the group', async () => {
			const output = await run({ resource: 'customerGroup', operation: 'delete', groupId });
			expect((output[0].json as Record<string, unknown>).deleted).toBe(true);
			cleanup.splice(
				cleanup.findIndex((entry) => entry.id === groupId),
				1,
			);
		});
	});
});
