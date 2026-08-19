import type { IExecuteFunctions, INodeProperties, JsonObject } from 'n8n-workflow';
import { medusaApiRequest } from '../../shared/transport';

const showFor = { resource: ['product'], operation: ['delete'] };

export const productDeleteDescription: INodeProperties[] = [
	{
		displayName: 'Product ID',
		name: 'productId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'prod_01ABCDEF',
		displayOptions: { show: showFor },
	},
];

export async function deleteProduct(this: IExecuteFunctions, index: number): Promise<JsonObject> {
	const productId = this.getNodeParameter('productId', index) as string;

	// Medusa answers { id, object, deleted: true }, which is passed through unchanged so a
	// workflow can branch on `deleted`.
	return medusaApiRequest.call(this, 'DELETE', `/admin/products/${productId}`, {
		resource: 'product',
		resourceId: productId,
	});
}
