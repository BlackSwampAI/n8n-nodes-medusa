import type { IDataObject, IExecuteFunctions, INodeProperties, JsonObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { medusaApiRequest } from '../../shared/transport';
import { PRODUCT_ID_FIELD } from './shared';

const showFor = { resource: ['productVariant'], operation: ['get'] };

export const variantGetDescription: INodeProperties[] = [
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
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showFor },
		options: [
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'string',
				default: '',
				placeholder: 'title,sku,*prices',
				description:
					'Comma-separated list of fields to return. Prefix a relation with * to expand it.',
			},
		],
	},
];

export async function getVariant(this: IExecuteFunctions, index: number): Promise<JsonObject> {
	const productId = this.getNodeParameter('productId', index) as string;
	const variantId = this.getNodeParameter('variantId', index) as string;
	const options = this.getNodeParameter('options', index, {}) as IDataObject;

	const response = await medusaApiRequest.call(
		this,
		'GET',
		`/admin/products/${productId}/variants/${variantId}`,
		{
			query: { fields: options.fields as string },
			resource: 'product variant',
			resourceId: variantId,
		},
	);

	const variant = response.variant as JsonObject | undefined;

	// Medusa answers 200 with an empty body for a variant ID that does not exist on this product,
	// rather than 404. Without this check the node would emit an empty item and the workflow would
	// carry on as though the read had succeeded.
	if (!variant) {
		throw new NodeOperationError(
			this.getNode(),
			`Product variant ${variantId} was not found on product ${productId}`,
			{
				description:
					'Check the variant ID, and that it belongs to this product. Medusa reports this as an empty success rather than as an error.',
				itemIndex: index,
			},
		);
	}

	return variant;
}
