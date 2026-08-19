import type { IExecuteFunctions, INodeProperties, JsonObject } from 'n8n-workflow';
import { medusaApiRequest } from '../../shared/transport';
import { PRODUCT_ID_FIELD } from './shared';

const showFor = { resource: ['productVariant'], operation: ['delete'] };

export const variantDeleteDescription: INodeProperties[] = [
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
];

export async function deleteVariant(this: IExecuteFunctions, index: number): Promise<JsonObject> {
	const productId = this.getNodeParameter('productId', index) as string;
	const variantId = this.getNodeParameter('variantId', index) as string;

	// Medusa answers { id, object, deleted, parent }, where parent is the product the variant was
	// removed from. Passed through unchanged.
	return medusaApiRequest.call(
		this,
		'DELETE',
		`/admin/products/${productId}/variants/${variantId}`,
		{ resource: 'product variant', resourceId: variantId },
	);
}
