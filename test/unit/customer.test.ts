import { describe, expect, it } from 'vitest';
import { buildListQuery } from '../../nodes/Medusa/shared/crud';
import { customerDescription, customerOperations } from '../../nodes/Medusa/resources/customer';
import {
	customerGroupDescription,
	customerGroupOperations,
} from '../../nodes/Medusa/resources/customerGroup';

describe('buildListQuery', () => {
	it('translates both date filters into Medusa operator syntax', () => {
		const query = buildListQuery(
			{ createdAfter: '2026-01-01T00:00:00Z', updatedAfter: '2026-02-01T00:00:00Z', q: 'ada' },
			{},
		);
		expect(query).toEqual({
			q: 'ada',
			'created_at[$gte]': '2026-01-01T00:00:00Z',
			'updated_at[$gte]': '2026-02-01T00:00:00Z',
		});
	});

	// Passing createdAfter through untouched would be silently ignored by Medusa, and the workflow
	// would receive every record instead of only the changes since its last run.
	it('does not leak the friendly filter names into the query', () => {
		const query = buildListQuery({ createdAfter: '2026-01-01T00:00:00Z' }, {});
		expect(query.createdAfter).toBeUndefined();
	});

	it('folds fields and sort order in from options', () => {
		expect(buildListQuery({}, { fields: 'id,email', order: '-created_at' })).toEqual({
			fields: 'id,email',
			order: '-created_at',
		});
	});

	it('leaves page size out, since it drives the loop rather than the request', () => {
		expect(buildListQuery({}, { pageSize: 25 })).toEqual({});
	});
});

describe('customer resource', () => {
	// Medusa accepts POST /admin/customers with an empty body and creates a record with every
	// field null. Requiring an email in the UI stops a workflow quietly filling the store with
	// customers that cannot be contacted or matched.
	it('requires an email even though the API does not', () => {
		const email = customerDescription.find(
			(field) =>
				field.name === 'email' && field.displayOptions?.show?.operation?.includes('create'),
		);
		expect(email?.required).toBe(true);
	});

	it('offers exactly the operations it implements', () => {
		const selector = customerDescription.find((field) => field.name === 'operation');
		const offered = (selector?.options ?? [])
			.map((option) => (option as { value: string }).value)
			.sort();
		expect(offered).toEqual(['create', 'delete', 'get', 'getAll', 'setGroups', 'update']);
		expect(Object.keys(customerOperations).sort()).toEqual(offered);
	});

	it('binds every field to the customer resource', () => {
		for (const field of customerDescription) {
			if (field.name === 'operation') continue;
			expect(field.displayOptions?.show?.resource, `${field.name} is unbound`).toEqual([
				'customer',
			]);
		}
	});
});

describe('customer group resource', () => {
	it('offers exactly the operations it implements', () => {
		const selector = customerGroupDescription.find((field) => field.name === 'operation');
		const offered = (selector?.options ?? [])
			.map((option) => (option as { value: string }).value)
			.sort();
		expect(offered).toEqual(['create', 'delete', 'get', 'getAll', 'setCustomers', 'update']);
		expect(Object.keys(customerGroupOperations).sort()).toEqual(offered);
	});

	it('binds every field to the customerGroup resource', () => {
		for (const field of customerGroupDescription) {
			if (field.name === 'operation') continue;
			expect(field.displayOptions?.show?.resource, `${field.name} is unbound`).toEqual([
				'customerGroup',
			]);
		}
	});
});
