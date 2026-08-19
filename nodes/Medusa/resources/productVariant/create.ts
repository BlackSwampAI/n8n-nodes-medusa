import type { IDataObject, IExecuteFunctions, INodeProperties, JsonObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { medusaApiRequest } from '../../shared/transport';
import {
	buildOptionValues,
	buildPrices,
	extractVariant,
	optionValuesField,
	pricesField,
	PRODUCT_ID_FIELD,
} from './shared';

const showFor = { resource: ['productVariant'], operation: ['create'] };
const bind = (field: INodeProperties): INodeProperties => ({
	...field,
	displayOptions: { show: showFor },
});

export const variantCreateDescription: INodeProperties[] = [
	bind(PRODUCT_ID_FIELD),
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Large',
		displayOptions: { show: showFor },
		description: 'Name of the variant',
	},
	bind(pricesField),
	bind(optionValuesField),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor },
		options: [
			{ displayName: 'Barcode', name: 'barcode', type: 'string', default: '' },
			{ displayName: 'EAN', name: 'ean', type: 'string', default: '' },
			{
				displayName: 'Manage Inventory',
				name: 'manage_inventory',
				type: 'boolean',
				default: true,
				description: 'Whether Medusa tracks stock levels for this variant',
			},
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'json',
				default: '{}',
				description: 'Arbitrary key-value data to store alongside the variant',
			},
			{
				displayName: 'SKU',
				name: 'sku',
				type: 'string',
				default: '',
				description: 'Stock keeping unit, unique across the store',
			},
			{
				displayName: 'UPC',
				name: 'upc',
				type: 'string',
				default: '',
			},
		],
	},
];

export async function createVariant(this: IExecuteFunctions, index: number): Promise<JsonObject> {
	const productId = this.getNodeParameter('productId', index) as string;
	const title = this.getNodeParameter('title', index) as string;
	const prices = buildPrices(this.getNodeParameter('prices', index, {}) as never);
	const optionValues = buildOptionValues(this.getNodeParameter('optionValues', index, {}) as never);
	const additionalFields = this.getNodeParameter('additionalFields', index, {}) as IDataObject;

	if (prices.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one price is required', {
			description: 'Medusa rejects a variant that has no price.',
			itemIndex: index,
		});
	}

	const body: IDataObject = { title, prices, ...additionalFields };
	if (optionValues) body.options = optionValues;

	if (typeof body.metadata === 'string') {
		try {
			body.metadata = JSON.parse(body.metadata);
		} catch {
			throw new NodeOperationError(this.getNode(), 'Metadata is not valid JSON', {
				itemIndex: index,
			});
		}
	}

	const response = await medusaApiRequest.call(
		this,
		'POST',
		`/admin/products/${productId}/variants`,
		{ body, resource: 'product variant', resourceId: productId },
	);

	return extractVariant(response.product as JsonObject, { title });
}
