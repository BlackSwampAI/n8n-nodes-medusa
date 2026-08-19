import { describe, expect, it } from 'vitest';
import { buildApplicationMethod } from '../../nodes/Medusa/resources/promotion';
import { buildPriceListPrices } from '../../nodes/Medusa/resources/priceList';
import { regionDescription, regionOperations } from '../../nodes/Medusa/resources/region';
import {
	salesChannelDescription,
	salesChannelOperations,
} from '../../nodes/Medusa/resources/salesChannel';
import { priceListDescription, priceListOperations } from '../../nodes/Medusa/resources/priceList';
import { promotionDescription, promotionOperations } from '../../nodes/Medusa/resources/promotion';

// Medusa's rules here are not guessable: max_quantity is mandatory when the allocation is "each"
// and the request is rejected without it, while a fixed-amount discount needs a currency.
describe('buildApplicationMethod', () => {
	const base = { type: 'percentage', value: 10, targetType: 'items', allocation: 'across' };

	it('builds a spread-across method without a max quantity', () => {
		expect(buildApplicationMethod(base)).toEqual({
			type: 'percentage',
			target_type: 'items',
			allocation: 'across',
			value: 10,
		});
	});

	it('adds the max quantity Medusa demands for an each allocation', () => {
		expect(buildApplicationMethod({ ...base, allocation: 'each', maxQuantity: 3 })).toMatchObject({
			allocation: 'each',
			max_quantity: 3,
		});
	});

	it('defaults the max quantity rather than sending a request that will be rejected', () => {
		expect(buildApplicationMethod({ ...base, allocation: 'each' })).toMatchObject({
			max_quantity: 1,
		});
	});

	it('lowercases the currency and omits it when absent', () => {
		expect(buildApplicationMethod({ ...base, currencyCode: 'USD' })).toMatchObject({
			currency_code: 'usd',
		});
		expect(buildApplicationMethod(base)).not.toHaveProperty('currency_code');
	});
});

describe('buildPriceListPrices', () => {
	it('maps the collection and lowercases currencies', () => {
		expect(
			buildPriceListPrices({
				price: [{ variant_id: 'variant_1', currency_code: 'EUR', amount: 9.5 }],
			}),
		).toEqual([{ variant_id: 'variant_1', currency_code: 'eur', amount: 9.5 }]);
	});

	it('drops rows with no variant, which an empty UI row produces', () => {
		expect(buildPriceListPrices({ price: [{ currency_code: 'usd', amount: 1 }] })).toEqual([]);
		expect(buildPriceListPrices({})).toEqual([]);
	});
});

describe('commerce configuration wiring', () => {
	const cases = [
		{
			label: 'region',
			resource: 'region',
			description: regionDescription,
			operations: regionOperations,
			expected: ['create', 'delete', 'get', 'getAll', 'update'],
		},
		{
			label: 'sales channel',
			resource: 'salesChannel',
			description: salesChannelDescription,
			operations: salesChannelOperations,
			expected: ['addProducts', 'create', 'delete', 'get', 'getAll', 'update'],
		},
		{
			label: 'price list',
			resource: 'priceList',
			description: priceListDescription,
			operations: priceListOperations,
			expected: [
				'addPrices',
				'addProducts',
				'create',
				'delete',
				'get',
				'getAll',
				'getPrices',
				'update',
			],
		},
		{
			label: 'promotion',
			resource: 'promotion',
			description: promotionDescription,
			operations: promotionOperations,
			expected: ['create', 'delete', 'get', 'getAll', 'update'],
		},
	];

	for (const subject of cases) {
		it(`${subject.label} offers exactly the operations it implements`, () => {
			const selector = subject.description.find((field) => field.name === 'operation');
			const offered = (selector?.options ?? [])
				.map((option) => (option as { value: string }).value)
				.sort();
			expect(offered).toEqual(subject.expected);
			expect(Object.keys(subject.operations).sort()).toEqual(subject.expected);
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

	// Medusa requires a description on a price list, which is unusual enough to pin.
	it('price list requires a description as well as a title', () => {
		const description = priceListDescription.find(
			(field) =>
				field.name === 'description' && field.displayOptions?.show?.operation?.includes('create'),
		);
		expect(description?.required).toBe(true);
	});
});
