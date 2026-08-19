import { describe, expect, it } from 'vitest';
import { buildProductOptions } from '../../nodes/Medusa/resources/product/create';
import { buildProductQuery } from '../../nodes/Medusa/resources/product/getAll';
import { productDescription, productOperations } from '../../nodes/Medusa/resources/product';

describe('buildProductOptions', () => {
	// Medusa rejects a product with no options, and rejects a variant whose option values do not
	// match a declared axis. The derived axis is what lets a caller create a product from a title
	// and a price alone.
	it('derives a single option axis from the variant titles', () => {
		const built = buildProductOptions(
			[{ title: 'Small' }, { title: 'Large' }],
			undefined,
			undefined,
		);
		expect(built.options).toEqual([{ title: 'Default', values: ['Small', 'Large'] }]);
		expect(built.variantOptions).toEqual([{ Default: 'Small' }, { Default: 'Large' }]);
	});

	it('names unnamed variants positionally so the axis still has distinct values', () => {
		const built = buildProductOptions([{}, {}], undefined, undefined);
		expect(built.options[0].values).toEqual(['Variant 1', 'Variant 2']);
	});

	it('uses explicit options when a product genuinely varies along several axes', () => {
		const built = buildProductOptions(
			[{ title: 'Small Red' }],
			[
				{ title: 'Size', values: ['S'] },
				{ title: 'Colour', values: ['Red'] },
			],
			[{ Size: 'S', Colour: 'Red' }],
		);
		expect(built.options).toHaveLength(2);
		expect(built.variantOptions).toEqual([{ Size: 'S', Colour: 'Red' }]);
	});
});

describe('buildProductQuery', () => {
	it('passes simple filters straight through', () => {
		expect(buildProductQuery({ q: 'chair', handle: 'oak-chair' }, {})).toEqual({
			q: 'chair',
			handle: 'oak-chair',
		});
	});

	// The operator form is the reason these cannot be forwarded unchanged.
	it('translates date filters into Medusa operator syntax', () => {
		const query = buildProductQuery(
			{ createdAfter: '2026-01-01T00:00:00Z', updatedAfter: '2026-02-01T00:00:00Z' },
			{},
		);
		expect(query['created_at[$gte]']).toBe('2026-01-01T00:00:00Z');
		expect(query['updated_at[$gte]']).toBe('2026-02-01T00:00:00Z');
		expect(query.createdAfter).toBeUndefined();
	});

	it('carries fields and sort order from options', () => {
		expect(buildProductQuery({}, { fields: 'id,title', order: '-created_at' })).toEqual({
			fields: 'id,title',
			order: '-created_at',
		});
	});

	it('leaves page size out of the query, since it drives the loop rather than the request', () => {
		expect(buildProductQuery({}, { pageSize: 25 })).toEqual({});
	});
});

describe('product resource wiring', () => {
	it('implements every operation it offers in the UI', () => {
		const selector = productDescription.find((field) => field.name === 'operation');
		const offered = (selector?.options ?? []).map((option) => (option as { value: string }).value);
		expect(offered.sort()).toEqual(['create', 'delete', 'get', 'getAll', 'update']);
		for (const operation of offered) {
			expect(productOperations[operation], `missing handler for ${operation}`).toBeTypeOf(
				'function',
			);
		}
	});

	it('offers no handler that the UI cannot reach', () => {
		const selector = productDescription.find((field) => field.name === 'operation');
		const offered = new Set(
			(selector?.options ?? []).map((option) => (option as { value: string }).value),
		);
		for (const operation of Object.keys(productOperations)) {
			expect(offered.has(operation), `${operation} has no UI entry`).toBe(true);
		}
	});

	it('binds every field to the product resource so it cannot leak into other resources', () => {
		for (const field of productDescription) {
			if (field.name === 'operation') continue;
			expect(field.displayOptions?.show?.resource, `${field.name} is unbound`).toEqual(['product']);
		}
	});
});
