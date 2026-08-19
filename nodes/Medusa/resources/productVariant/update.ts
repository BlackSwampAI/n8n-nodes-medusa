import type { IDataObject, IExecuteFunctions, INodeProperties, JsonObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { medusaApiRequest } from '../../shared/transport';
import { buildPrices, extractVariant, PRODUCT_ID_FIELD } from './shared';

const showFor = { resource: ['productVariant'], operation: ['update'] };

export const variantUpdateDescription: INodeProperties[] = [
	{ ...PRODUCT_ID_FIELD, displayOptions: { show: showFor } },
	{
		displayName: 'Variant ID',
		name: 'variantId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'variant_01ABCDEF',
		displayOptions: { show: showFor },
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
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
			},
			{
				displayName: 'Prices',
				name: 'prices',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				description: 'Replaces the whole price list for this variant',
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
								description: 'Three-letter ISO currency code, lowercase',
							},
							{
								displayName: 'Amount',
								name: 'amount',
								type: 'number',
								default: 0,
								description: "Price in the currency's main unit",
							},
						],
					},
				],
			},
			{ displayName: 'SKU', name: 'sku', type: 'string', default: '' },
			{ displayName: 'Title', name: 'title', type: 'string', default: '' },
			{ displayName: 'UPC', name: 'upc', type: 'string', default: '' },
		],
	},
];

export async function updateVariant(this: IExecuteFunctions, index: number): Promise<JsonObject> {
	const productId = this.getNodeParameter('productId', index) as string;
	const variantId = this.getNodeParameter('variantId', index) as string;
	const updateFields = this.getNodeParameter('updateFields', index, {}) as IDataObject;

	if (Object.keys(updateFields).length === 0) {
		throw new NodeOperationError(this.getNode(), 'No fields to update were provided', {
			description: 'Add at least one field under Update Fields.',
			itemIndex: index,
		});
	}

	const body: IDataObject = { ...updateFields };

	if (body.prices) body.prices = buildPrices(body.prices as never);

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
		`/admin/products/${productId}/variants/${variantId}`,
		{ body, resource: 'product variant', resourceId: variantId },
	);

	return extractVariant(response.product as JsonObject, { variantId });
}
