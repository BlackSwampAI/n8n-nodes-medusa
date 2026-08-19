import type { IDataObject, INodeProperties, JsonObject } from 'n8n-workflow';

export const PRODUCT_ID_FIELD: INodeProperties = {
	displayName: 'Product ID',
	name: 'productId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'prod_01ABCDEF',
	description: 'Product this variant belongs to. Variants are always addressed through a product.',
};

export interface PriceInput {
	currencyCode?: string;
	amount?: number;
}

export interface OptionValueInput {
	name?: string;
	value?: string;
}

export const pricesField: INodeProperties = {
	displayName: 'Prices',
	name: 'prices',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true, sortable: true },
	required: true,
	default: { price: [{ currencyCode: 'usd', amount: 0 }] },
	description: 'Medusa requires at least one price per variant',
	options: [
		{
			displayName: 'Price',
			name: 'price',
			values: [
				{
					displayName: 'Currency Code',
					name: 'currencyCode',
					type: 'string',
					default: 'usd',
					required: true,
					placeholder: 'usd',
					description: 'Three-letter ISO currency code, lowercase',
				},
				{
					displayName: 'Amount',
					name: 'amount',
					type: 'number',
					default: 0,
					required: true,
					description:
						"Price in the currency's main unit, so 10.5 means 10.50 rather than 10 and a half cents",
				},
			],
		},
	],
};

export const optionValuesField: INodeProperties = {
	displayName: 'Option Values',
	name: 'optionValues',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	default: {},
	description:
		'Which option value this variant represents, one entry per option axis on the product. The value must already exist on the product — Medusa will not create it. Add it to the product first if it is new.',
	options: [
		{
			displayName: 'Option Value',
			name: 'optionValue',
			values: [
				{
					displayName: 'Option Name',
					name: 'name',
					type: 'string',
					default: '',
					placeholder: 'Size',
					description: 'Title of the option axis as declared on the product',
				},
				{
					displayName: 'Value',
					name: 'value',
					type: 'string',
					default: '',
					placeholder: 'Large',
					description: 'One of the values already declared for that option',
				},
			],
		},
	],
};

/** Turns the Option Values collection into the `{ Size: 'Large' }` map Medusa expects. */
export function buildOptionValues(collection: {
	optionValue?: OptionValueInput[];
}): IDataObject | undefined {
	const entries = collection?.optionValue ?? [];
	if (entries.length === 0) return undefined;

	const options: IDataObject = {};
	for (const entry of entries) {
		if (entry.name) options[entry.name] = entry.value ?? '';
	}
	return options;
}

/** Turns the Prices collection into Medusa's price array. */
export function buildPrices(collection: { price?: PriceInput[] }): IDataObject[] {
	return (collection?.price ?? []).map((price) => ({
		currency_code: (price.currencyCode || 'usd').toLowerCase(),
		amount: price.amount ?? 0,
	}));
}

/**
 * Creating and updating a variant both answer with the whole product rather than the variant that
 * changed, so the variant has to be picked back out of it.
 *
 * When an ID is known — every update — it is matched exactly. After a create there is no ID yet,
 * so the newest variant carrying the requested title is taken, which is unambiguous because a
 * create adds exactly one.
 */
export function extractVariant(
	product: JsonObject,
	match: { variantId?: string; title?: string },
): JsonObject {
	const variants = (product?.variants ?? []) as JsonObject[];

	if (match.variantId) {
		const found = variants.find((variant) => variant.id === match.variantId);
		if (found) return found;
	}

	if (match.title) {
		const candidates = variants.filter((variant) => variant.title === match.title);
		if (candidates.length > 0) {
			return candidates.reduce((newest, variant) =>
				String(variant.created_at ?? '') >= String(newest.created_at ?? '') ? variant : newest,
			);
		}
	}

	// Nothing matched, which should not happen. Returning the product is more useful than throwing
	// away a successful write.
	return product;
}
