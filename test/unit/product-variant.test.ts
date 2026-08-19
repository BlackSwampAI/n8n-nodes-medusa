import { describe, expect, it } from 'vitest';
import {
	buildOptionValues,
	buildPrices,
	extractVariant,
} from '../../nodes/Medusa/resources/productVariant/shared';
import { variantListPath } from '../../nodes/Medusa/resources/productVariant/getAll';
import { variantDescription, variantOperations } from '../../nodes/Medusa/resources/productVariant';

describe('buildOptionValues', () => {
	it('turns the collection into the map Medusa expects', () => {
		expect(
			buildOptionValues({
				optionValue: [
					{ name: 'Size', value: 'Large' },
					{ name: 'Colour', value: 'Red' },
				],
			}),
		).toEqual({ Size: 'Large', Colour: 'Red' });
	});

	it('returns nothing when no values are given, so the key is omitted entirely', () => {
		expect(buildOptionValues({})).toBeUndefined();
		expect(buildOptionValues({ optionValue: [] })).toBeUndefined();
	});

	it('skips entries with no option name', () => {
		expect(buildOptionValues({ optionValue: [{ value: 'orphan' }] })).toEqual({});
	});
});

describe('buildPrices', () => {
	it('maps to Medusa price objects and lowercases the currency', () => {
		expect(buildPrices({ price: [{ currencyCode: 'USD', amount: 10.5 }] })).toEqual([
			{ currency_code: 'usd', amount: 10.5 },
		]);
	});

	it('supports several currencies on one variant', () => {
		expect(
			buildPrices({
				price: [
					{ currencyCode: 'usd', amount: 10 },
					{ currencyCode: 'eur', amount: 9 },
				],
			}),
		).toHaveLength(2);
	});

	it('returns an empty list when none are given, so the caller can reject it', () => {
		expect(buildPrices({})).toEqual([]);
	});
});

// Create and update both answer with the whole product rather than the variant that changed.
describe('extractVariant', () => {
	const product = {
		id: 'prod_1',
		variants: [
			{ id: 'variant_a', title: 'Small', created_at: '2026-01-01T00:00:00Z' },
			{ id: 'variant_b', title: 'Large', created_at: '2026-01-02T00:00:00Z' },
		],
	};

	it('matches by ID when one is known, which is every update', () => {
		expect(extractVariant(product, { variantId: 'variant_b' })).toMatchObject({ id: 'variant_b' });
	});

	it('matches by title after a create, when no ID exists yet', () => {
		expect(extractVariant(product, { title: 'Small' })).toMatchObject({ id: 'variant_a' });
	});

	it('takes the newest when a title is duplicated', () => {
		const duplicated = {
			id: 'prod_1',
			variants: [
				{ id: 'old', title: 'Large', created_at: '2026-01-01T00:00:00Z' },
				{ id: 'new', title: 'Large', created_at: '2026-06-01T00:00:00Z' },
			],
		};
		expect(extractVariant(duplicated, { title: 'Large' })).toMatchObject({ id: 'new' });
	});

	it('falls back to the product rather than discarding a successful write', () => {
		expect(extractVariant(product, { variantId: 'nope' })).toMatchObject({ id: 'prod_1' });
		expect(extractVariant({ id: 'prod_1' }, { title: 'anything' })).toMatchObject({ id: 'prod_1' });
	});
});

// The cross-product route rejects a product_id filter outright, so narrowing means switching route.
describe('variantListPath', () => {
	it('uses the nested route when narrowing to one product', () => {
		expect(variantListPath('prod_1')).toBe('/admin/products/prod_1/variants');
	});

	it('uses the cross-product route otherwise', () => {
		expect(variantListPath()).toBe('/admin/product-variants');
		expect(variantListPath('')).toBe('/admin/product-variants');
	});
});

describe('product variant resource wiring', () => {
	it('implements every operation it offers, and offers every operation it implements', () => {
		const selector = variantDescription.find((field) => field.name === 'operation');
		const offered = (selector?.options ?? []).map((option) => (option as { value: string }).value);
		expect(offered.sort()).toEqual(['create', 'delete', 'get', 'getAll', 'update']);
		expect(Object.keys(variantOperations).sort()).toEqual(offered.sort());
	});

	it('binds every field to the productVariant resource', () => {
		for (const field of variantDescription) {
			if (field.name === 'operation') continue;
			expect(field.displayOptions?.show?.resource, `${field.name} is unbound`).toEqual([
				'productVariant',
			]);
		}
	});
});
