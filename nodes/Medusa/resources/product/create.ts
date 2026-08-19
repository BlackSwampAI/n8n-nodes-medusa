import type { IDataObject, IExecuteFunctions, INodeProperties, JsonObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { medusaApiRequest } from '../../shared/transport';

const showFor = { resource: ['product'], operation: ['create'] };

export const productCreateDescription: INodeProperties[] = [
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Oak Dining Chair',
		displayOptions: { show: showFor },
		description: 'Name of the product',
	},
	{
		displayName: 'Variants',
		name: 'variants',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true, sortable: true },
		required: true,
		default: { variant: [{ title: 'Default', currencyCode: 'usd', amount: 0 }] },
		displayOptions: { show: showFor },
		description:
			'Purchasable versions of this product. Medusa requires at least one variant with a price.',
		options: [
			{
				displayName: 'Variant',
				name: 'variant',
				values: [
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						required: true,
						placeholder: 'Large',
						description: 'Name of this variant, unique within the product',
					},
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
					{
						displayName: 'SKU',
						name: 'sku',
						type: 'string',
						default: '',
						description: 'Stock keeping unit, unique across the store',
					},
				],
			},
		],
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor },
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
			},
			{
				displayName: 'Discountable',
				name: 'discountable',
				type: 'boolean',
				default: true,
				description: 'Whether promotions can apply to this product',
			},
			{
				displayName: 'External ID',
				name: 'external_id',
				type: 'string',
				default: '',
				description: 'Identifier for this product in the system it was synced from',
			},
			{
				displayName: 'Handle',
				name: 'handle',
				type: 'string',
				default: '',
				description: 'URL slug. Generated from the title when left empty.',
			},
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'json',
				default: '{}',
				description: 'Arbitrary key-value data to store alongside the product',
			},
			{
				displayName: 'Product Options (JSON)',
				name: 'optionsJson',
				type: 'json',
				default: '',
				placeholder: '[{"title":"Size","values":["S","M","L"]}]',
				description:
					'Option axes for products that vary along more than one dimension. Leave empty and a single axis is derived from the variant titles. When set, each variant must carry matching option values, which requires the Variant Options JSON field.',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'draft',
				options: [
					{ name: 'Draft', value: 'draft' },
					{ name: 'Proposed', value: 'proposed' },
					{ name: 'Published', value: 'published' },
					{ name: 'Rejected', value: 'rejected' },
				],
			},
			{
				displayName: 'Subtitle',
				name: 'subtitle',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Variant Options (JSON)',
				name: 'variantOptionsJson',
				type: 'json',
				default: '',
				placeholder: '[{"Size":"S"},{"Size":"M"}]',
				description:
					'Option values for each variant, in the same order as the Variants list. Only needed alongside Product Options (JSON).',
			},
		],
	},
];

interface VariantInput {
	title?: string;
	currencyCode?: string;
	amount?: number;
	sku?: string;
}

/** Parses a JSON field that may arrive as a string or as an already-parsed value. */
function parseJsonField(node: IExecuteFunctions, fieldName: string, value: unknown): unknown {
	if (value === undefined || value === '' || value === null) return undefined;
	if (typeof value !== 'string') return value;

	try {
		return JSON.parse(value);
	} catch {
		throw new NodeOperationError(node.getNode(), `${fieldName} is not valid JSON`, {
			description: 'Check the value for a missing quote, comma or bracket.',
		});
	}
}

/**
 * Medusa rejects a product that declares no options, and rejects a variant whose option values do
 * not match a declared axis. Rather than force every caller to model that, a single implicit axis
 * is derived from the variant titles, which covers the common case of a product whose variants
 * differ along one dimension. Callers with genuine multi-axis products supply both JSON fields.
 */
export function buildProductOptions(
	variants: VariantInput[],
	explicitOptions: unknown,
	explicitVariantOptions: unknown,
): { options: IDataObject[]; variantOptions: IDataObject[] } {
	if (explicitOptions !== undefined) {
		const options = explicitOptions as IDataObject[];
		const variantOptions = (explicitVariantOptions as IDataObject[] | undefined) ?? [];
		return { options, variantOptions };
	}

	const titles = variants.map((variant, index) => variant.title || `Variant ${index + 1}`);

	return {
		options: [{ title: 'Default', values: titles }],
		variantOptions: titles.map((title) => ({ Default: title })),
	};
}

export async function createProduct(this: IExecuteFunctions, index: number): Promise<JsonObject> {
	const title = this.getNodeParameter('title', index) as string;
	const additionalFields = this.getNodeParameter('additionalFields', index, {}) as IDataObject;
	const variantCollection = this.getNodeParameter('variants', index, {}) as {
		variant?: VariantInput[];
	};
	const variants = variantCollection.variant ?? [];

	if (variants.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one variant is required', {
			description: 'Medusa cannot create a product that has nothing to sell.',
			itemIndex: index,
		});
	}

	const { optionsJson, variantOptionsJson, metadata, ...rest } = additionalFields;

	const { options, variantOptions } = buildProductOptions(
		variants,
		parseJsonField(this, 'Product Options (JSON)', optionsJson),
		parseJsonField(this, 'Variant Options (JSON)', variantOptionsJson),
	);

	const body: IDataObject = {
		title,
		...rest,
		options,
		variants: variants.map((variant, variantIndex) => {
			const built: IDataObject = {
				title: variant.title || `Variant ${variantIndex + 1}`,
				options: variantOptions[variantIndex] ?? {},
				prices: [
					{
						currency_code: (variant.currencyCode || 'usd').toLowerCase(),
						amount: variant.amount ?? 0,
					},
				],
			};
			if (variant.sku) built.sku = variant.sku;
			return built;
		}),
	};

	const parsedMetadata = parseJsonField(this, 'Metadata', metadata);
	if (parsedMetadata !== undefined) body.metadata = parsedMetadata;

	const response = await medusaApiRequest.call(this, 'POST', '/admin/products', {
		body,
		resource: 'product',
	});

	return response.product as JsonObject;
}
