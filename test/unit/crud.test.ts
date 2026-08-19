import { describe, expect, it, vi } from 'vitest';
import type { IExecuteFunctions } from 'n8n-workflow';
import { makeAssign, parseMetadata, type CrudConfig } from '../../nodes/Medusa/shared/crud';
import {
	buildCategoryQuery,
	categoryDescription,
	categoryOperations,
} from '../../nodes/Medusa/resources/productCategory';
import {
	collectionDescription,
	collectionOperations,
} from '../../nodes/Medusa/resources/productCollection';

const config: CrudConfig = {
	path: '/admin/things',
	responseKey: 'thing',
	collectionKey: 'things',
	resourceLabel: 'thing',
	idParameter: 'thingId',
};

/** Captures the request a handler would send, without any network. */
function contextWith(parameters: Record<string, unknown>) {
	const sent: Array<{ method: string; url: string; body: unknown }> = [];
	const context = {
		getNode: () => ({ name: 'Medusa' }),
		getNodeParameter: (name: string, _index: number, fallback?: unknown) =>
			name in parameters ? parameters[name] : fallback,
		getCredentials: async () => ({ baseUrl: 'https://example.com', apiToken: 'sk_test' }),
		helpers: {
			httpRequestWithAuthentication: vi.fn(async (_credential: string, request: never) => {
				const typed = request as unknown as { method: string; url: string; body: unknown };
				sent.push({ method: typed.method, url: typed.url, body: typed.body });
				return { thing: { id: 'thing_1' } };
			}),
		},
	} as unknown as IExecuteFunctions;

	return { context, sent };
}

describe('parseMetadata', () => {
	const node = { getNode: () => ({ name: 'Medusa' }) } as unknown as IExecuteFunctions;

	it('parses a JSON string into an object', () => {
		expect(parseMetadata(node, { metadata: '{"tier":"gold"}' }, 0)).toEqual({
			metadata: { tier: 'gold' },
		});
	});

	it('leaves a body without metadata untouched', () => {
		expect(parseMetadata(node, { name: 'x' }, 0)).toEqual({ name: 'x' });
	});

	it('reports invalid JSON rather than sending it', () => {
		expect(() => parseMetadata(node, { metadata: '{oops' }, 0)).toThrow(/not valid JSON/);
	});
});

describe('makeAssign', () => {
	const assign = makeAssign(config, 'products', { add: 'addIds', remove: 'removeIds' });

	it('splits comma-separated IDs and trims them', async () => {
		const { context, sent } = contextWith({
			thingId: 'thing_1',
			addIds: 'prod_1, prod_2 ,prod_3',
			removeIds: '',
		});

		await assign.call(context, 0);

		expect(sent[0].method).toBe('POST');
		expect(sent[0].url).toBe('https://example.com/admin/things/thing_1/products');
		expect(sent[0].body).toEqual({ add: ['prod_1', 'prod_2', 'prod_3'] });
	});

	it('adds and removes in a single call, which is what Medusa accepts', async () => {
		const { context, sent } = contextWith({
			thingId: 'thing_1',
			addIds: 'prod_1',
			removeIds: 'prod_2',
		});

		await assign.call(context, 0);

		expect(sent[0].body).toEqual({ add: ['prod_1'], remove: ['prod_2'] });
	});

	it('omits an empty side rather than sending an empty array', async () => {
		const { context, sent } = contextWith({ thingId: 'thing_1', addIds: '', removeIds: 'prod_2' });
		await assign.call(context, 0);
		expect(sent[0].body).toEqual({ remove: ['prod_2'] });
	});

	it('refuses a call that would do nothing', async () => {
		const { context } = contextWith({ thingId: 'thing_1', addIds: ' , ', removeIds: '' });
		await expect(assign.call(context, 0)).rejects.toThrow(/nothing to add or remove/i);
	});
});

describe('buildCategoryQuery', () => {
	it('passes filters through and folds in list options', () => {
		expect(buildCategoryQuery({ q: 'chairs', is_active: true }, { fields: 'id,name' })).toEqual({
			q: 'chairs',
			is_active: true,
			fields: 'id,name',
		});
	});
});

describe('category and collection wiring', () => {
	const cases = [
		{
			label: 'category',
			description: categoryDescription,
			operations: categoryOperations,
			resource: 'productCategory',
		},
		{
			label: 'collection',
			description: collectionDescription,
			operations: collectionOperations,
			resource: 'productCollection',
		},
	];

	for (const subject of cases) {
		it(`${subject.label} offers exactly the operations it implements`, () => {
			const selector = subject.description.find((field) => field.name === 'operation');
			const offered = (selector?.options ?? [])
				.map((option) => (option as { value: string }).value)
				.sort();
			expect(offered).toEqual(['addProducts', 'create', 'delete', 'get', 'getAll', 'update']);
			expect(Object.keys(subject.operations).sort()).toEqual(offered);
		});

		it(`${subject.label} binds every field to its own resource`, () => {
			for (const field of subject.description) {
				if (field.name === 'operation') continue;
				expect(field.displayOptions?.show?.resource, `${field.name} is unbound`).toEqual([
					subject.resource,
				]);
			}
		});
	}
});
