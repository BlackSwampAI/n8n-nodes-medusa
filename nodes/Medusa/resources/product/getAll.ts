import type { IDataObject, IExecuteFunctions, INodeProperties, JsonObject } from 'n8n-workflow';
import { listOptionsFields, paginationFields } from '../../shared/descriptions';
import { medusaApiRequestAllItems } from '../../shared/transport';

const showFor = { resource: ['product'], operation: ['getAll'] };

export const productGetAllDescription: INodeProperties[] = [
	...paginationFields('product'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: showFor },
		options: [
			{
				displayName: 'Category ID',
				name: 'category_id',
				type: 'string',
				default: '',
				description: 'Return only products in this category',
			},
			{
				displayName: 'Collection ID',
				name: 'collection_id',
				type: 'string',
				default: '',
				description: 'Return only products in this collection',
			},
			{
				displayName: 'Created After',
				name: 'createdAfter',
				type: 'dateTime',
				default: '',
				description: 'Return only products created at or after this time',
			},
			{
				displayName: 'Handle',
				name: 'handle',
				type: 'string',
				default: '',
				description: 'Return only the product with this exact handle',
			},
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Free-text search across product fields such as title and description',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				default: [],
				options: [
					{ name: 'Draft', value: 'draft' },
					{ name: 'Proposed', value: 'proposed' },
					{ name: 'Published', value: 'published' },
					{ name: 'Rejected', value: 'rejected' },
				],
				description: 'Return only products in these states',
			},
			{
				displayName: 'Updated After',
				name: 'updatedAfter',
				type: 'dateTime',
				default: '',
				description:
					'Return only products updated at or after this time. Useful for syncing changes since a previous run.',
			},
		],
	},
	listOptionsFields('product'),
];

/**
 * Translates the filter fields into Medusa's query syntax.
 *
 * Date ranges use the operator form `created_at[$gte]`, which is the shape Medusa expects and is
 * the reason these cannot simply be passed through as-is.
 */
export function buildProductQuery(filters: IDataObject, options: IDataObject): IDataObject {
	const { createdAfter, updatedAfter, ...direct } = filters;
	const query: IDataObject = { ...direct };

	if (createdAfter) query['created_at[$gte]'] = createdAfter;
	if (updatedAfter) query['updated_at[$gte]'] = updatedAfter;
	if (options.fields) query.fields = options.fields;
	if (options.order) query.order = options.order;

	return query;
}

export async function getAllProducts(
	this: IExecuteFunctions,
	index: number,
): Promise<JsonObject[]> {
	const returnAll = this.getNodeParameter('returnAll', index, false) as boolean;
	const limit = returnAll ? 0 : (this.getNodeParameter('limit', index, 50) as number);
	const filters = this.getNodeParameter('filters', index, {}) as IDataObject;
	const options = this.getNodeParameter('options', index, {}) as IDataObject;

	return medusaApiRequestAllItems.call(this, '/admin/products', 'products', {
		returnAll,
		limit,
		pageSize: options.pageSize as number | undefined,
		query: buildProductQuery(filters, options),
		resource: 'product',
	}) as Promise<JsonObject[]>;
}
