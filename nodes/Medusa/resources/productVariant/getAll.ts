import type { IDataObject, IExecuteFunctions, INodeProperties, JsonObject } from 'n8n-workflow';
import { listOptionsFields, paginationFields } from '../../shared/descriptions';
import { medusaApiRequestAllItems } from '../../shared/transport';

const showFor = { resource: ['productVariant'], operation: ['getAll'] };

export const variantGetAllDescription: INodeProperties[] = [
	{
		displayName: 'Product ID',
		name: 'productId',
		type: 'string',
		default: '',
		placeholder: 'prod_01ABCDEF',
		displayOptions: { show: showFor },
		description:
			'Return only variants of this product. Leave empty to search variants across every product.',
	},
	...paginationFields('productVariant'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: showFor },
		options: [
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Free-text search across variant fields such as title and SKU',
			},
		],
	},
	listOptionsFields('productVariant'),
];

/**
 * Medusa offers two routes for variants and they are not interchangeable.
 *
 * The cross-product route `/admin/product-variants` rejects a `product_id` filter outright with
 * "Unrecognized fields", so narrowing to one product means addressing that product's own nested
 * route instead.
 */
export function variantListPath(productId?: string): string {
	return productId ? `/admin/products/${productId}/variants` : '/admin/product-variants';
}

export async function getAllVariants(
	this: IExecuteFunctions,
	index: number,
): Promise<JsonObject[]> {
	const productId = this.getNodeParameter('productId', index, '') as string;
	const returnAll = this.getNodeParameter('returnAll', index, false) as boolean;
	const limit = returnAll ? 0 : (this.getNodeParameter('limit', index, 50) as number);
	const filters = this.getNodeParameter('filters', index, {}) as IDataObject;
	const options = this.getNodeParameter('options', index, {}) as IDataObject;

	const query: IDataObject = { ...filters };
	if (options.fields) query.fields = options.fields;
	if (options.order) query.order = options.order;

	return medusaApiRequestAllItems.call(this, variantListPath(productId), 'variants', {
		returnAll,
		limit,
		pageSize: options.pageSize as number | undefined,
		query,
		resource: 'product variant',
	}) as Promise<JsonObject[]>;
}
