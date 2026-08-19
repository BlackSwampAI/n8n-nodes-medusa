import type { IDataObject, IExecuteFunctions, INodeProperties, JsonObject } from 'n8n-workflow';
import { medusaApiRequest } from '../../shared/transport';

const showFor = { resource: ['product'], operation: ['get'] };

export const productGetDescription: INodeProperties[] = [
	{
		displayName: 'Product ID',
		name: 'productId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'prod_01ABCDEF',
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
				placeholder: 'title,handle,*variants',
				description:
					'Comma-separated list of fields to return. Prefix a relation with * to expand it, for example *variants.',
			},
		],
	},
];

export async function getProduct(this: IExecuteFunctions, index: number): Promise<JsonObject> {
	const productId = this.getNodeParameter('productId', index) as string;
	const options = this.getNodeParameter('options', index, {}) as IDataObject;

	const response = await medusaApiRequest.call(this, 'GET', `/admin/products/${productId}`, {
		query: { fields: options.fields as string },
		resource: 'product',
		resourceId: productId,
	});

	return response.product as JsonObject;
}
