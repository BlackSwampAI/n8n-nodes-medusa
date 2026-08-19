import type { IDataObject, IExecuteFunctions, INodeProperties, JsonObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
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

	const product = response.product as JsonObject | undefined;

	// GET /admin/products/{id} does throw a real 404 today, so this guard is not load-bearing yet.
	// It is here because Medusa has two idioms for missing records — an explicit NOT_FOUND throw,
	// and returning 200 with an empty envelope — and which one a route uses is not something the
	// OpenAPI specification records. Every other Get in this node already guards, so this keeps
	// product from being the one that silently emits an empty item if that route is ever
	// refactored to the other idiom.
	if (!product) {
		throw new NodeOperationError(this.getNode(), `product ${productId} was not found`, {
			description:
				'It may have been deleted, or the ID may belong to a different Medusa installation.',
			itemIndex: index,
		});
	}

	return product;
}
