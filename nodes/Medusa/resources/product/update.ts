import type { IDataObject, IExecuteFunctions, INodeProperties, JsonObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { medusaApiRequest } from '../../shared/transport';

const showFor = { resource: ['product'], operation: ['update'] };

export const productUpdateDescription: INodeProperties[] = [
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
		displayName: 'Update Fields',
		name: 'updateFields',
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
			},
			{
				displayName: 'Handle',
				name: 'handle',
				type: 'string',
				default: '',
				description: 'URL slug',
			},
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'json',
				default: '{}',
				description: 'Arbitrary key-value data to store alongside the product',
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
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
			},
		],
	},
];

export async function updateProduct(this: IExecuteFunctions, index: number): Promise<JsonObject> {
	const productId = this.getNodeParameter('productId', index) as string;
	const updateFields = this.getNodeParameter('updateFields', index, {}) as IDataObject;

	if (Object.keys(updateFields).length === 0) {
		throw new NodeOperationError(this.getNode(), 'No fields to update were provided', {
			description: 'Add at least one field under Update Fields.',
			itemIndex: index,
		});
	}

	const body: IDataObject = { ...updateFields };

	if (typeof body.metadata === 'string') {
		try {
			body.metadata = JSON.parse(body.metadata);
		} catch {
			throw new NodeOperationError(this.getNode(), 'Metadata is not valid JSON', {
				itemIndex: index,
			});
		}
	}

	// Medusa updates with POST rather than PUT or PATCH. There is no PUT or PATCH anywhere in its
	// Admin API, so this is not a mistake.
	const response = await medusaApiRequest.call(this, 'POST', `/admin/products/${productId}`, {
		body,
		resource: 'product',
		resourceId: productId,
	});

	return response.product as JsonObject;
}
