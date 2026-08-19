import type { IDataObject, IExecuteFunctions, INodeProperties, JsonObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { listOptionsFields, paginationFields } from '../../shared/descriptions';
import {
	buildListQuery,
	makeAssign,
	makeCreate,
	makeDelete,
	makeGet,
	makeGetAll,
	makeUpdate,
	type CrudConfig,
} from '../../shared/crud';
import { medusaApiRequest, medusaApiRequestAllItems } from '../../shared/transport';
import type { OperationHandlers } from '../../shared/types';

const RESOURCE = 'priceList';

const config: CrudConfig = {
	path: '/admin/price-lists',
	responseKey: 'price_list',
	collectionKey: 'price_lists',
	resourceLabel: 'price list',
	idParameter: 'priceListId',
};

const showFor = (operation: string | string[]) => ({
	resource: [RESOURCE],
	operation: Array.isArray(operation) ? operation : [operation],
});

const priceListIdField = (operation: string | string[]): INodeProperties => ({
	displayName: 'Price List ID',
	name: 'priceListId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'plist_01ABCDEF',
	displayOptions: { show: showFor(operation) },
});

const sharedFields: INodeProperties[] = [
	{
		displayName: 'Ends At',
		name: 'ends_at',
		type: 'dateTime',
		default: '',
		description: 'When the list stops applying',
	},
	{
		displayName: 'Starts At',
		name: 'starts_at',
		type: 'dateTime',
		default: '',
		description: 'When the list begins applying',
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		default: 'draft',
		options: [
			{ name: 'Active', value: 'active' },
			{ name: 'Draft', value: 'draft' },
		],
		description: 'A draft list does not affect prices',
	},
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		default: 'sale',
		options: [
			{ name: 'Override', value: 'override' },
			{ name: 'Sale', value: 'sale' },
		],
	},
];

export const priceListDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'getAll',
		displayOptions: { show: { resource: [RESOURCE] } },
		options: [
			{
				name: 'Add Prices',
				value: 'addPrices',
				action: 'Add prices to a price list',
				description: 'Add variant prices to a price list',
			},
			{
				name: 'Add Products',
				value: 'addProducts',
				action: 'Add or remove products in a price list',
				description: 'Add or remove products in a price list',
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a price list',
				description: 'Create a price list',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a price list',
				description: 'Delete a price list',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a price list',
				description: 'Retrieve a single price list',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many price lists',
				description: 'Retrieve many price lists',
			},
			{
				name: 'Get Prices',
				value: 'getPrices',
				action: 'Get prices in a price list',
				description: 'Retrieve the prices in a price list',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a price list',
				description: 'Update a price list',
			},
		],
	},

	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Summer Sale',
		displayOptions: { show: showFor('create') },
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: showFor('create') },
		description: 'Medusa requires a description on a price list, not just a title',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('create') },
		options: sharedFields,
	},

	priceListIdField('get'),
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showFor('get') },
		options: [
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'string',
				default: '',
				placeholder: 'title,status,*prices',
				description:
					'Comma-separated list of fields to return. Prefix a relation with * to expand it.',
			},
		],
	},

	...paginationFields(RESOURCE),
	...paginationFields(RESOURCE, 'getPrices'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: showFor('getAll') },
		options: [
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Free-text search across price list fields such as title',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				default: [],
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Draft', value: 'draft' },
				],
			},
		],
	},
	listOptionsFields(RESOURCE),

	priceListIdField('update'),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('update') },
		options: [
			{ displayName: 'Title', name: 'title', type: 'string', default: '' },
			{ displayName: 'Description', name: 'description', type: 'string', default: '' },
			...sharedFields,
		],
	},

	priceListIdField('delete'),
	priceListIdField('getPrices'),

	priceListIdField('addPrices'),
	{
		displayName: 'Prices',
		name: 'prices',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true, sortable: true },
		required: true,
		default: {},
		displayOptions: { show: showFor('addPrices') },
		description: 'Variant prices to add to this list',
		options: [
			{
				displayName: 'Price',
				name: 'price',
				values: [
					{
						displayName: 'Variant ID',
						name: 'variant_id',
						type: 'string',
						default: '',
						required: true,
						placeholder: 'variant_01ABCDEF',
					},
					{
						displayName: 'Currency Code',
						name: 'currency_code',
						type: 'string',
						default: 'usd',
						required: true,
						description: 'Three-letter ISO currency code, lowercase',
					},
					{
						displayName: 'Amount',
						name: 'amount',
						type: 'number',
						default: 0,
						required: true,
						description: "Price in the currency's main unit",
					},
				],
			},
		],
	},

	priceListIdField('addProducts'),
	{
		displayName: 'Product IDs to Add',
		name: 'addProductIds',
		type: 'string',
		default: '',
		placeholder: 'prod_01ABC,prod_01DEF',
		displayOptions: { show: showFor('addProducts') },
		description: 'Comma-separated product IDs to include in this price list',
	},
	{
		displayName: 'Product IDs to Remove',
		name: 'removeProductIds',
		type: 'string',
		default: '',
		placeholder: 'prod_01GHI',
		displayOptions: { show: showFor('addProducts') },
		description: 'Comma-separated product IDs to remove from this price list',
	},
];

function createBody(context: IExecuteFunctions, index: number): IDataObject {
	return {
		title: context.getNodeParameter('title', index) as string,
		description: context.getNodeParameter('description', index) as string,
		...(context.getNodeParameter('additionalFields', index, {}) as IDataObject),
	};
}

function updateBody(context: IExecuteFunctions, index: number): IDataObject {
	return { ...(context.getNodeParameter('updateFields', index, {}) as IDataObject) };
}

interface PriceInput {
	variant_id?: string;
	currency_code?: string;
	amount?: number;
}

/** Turns the Prices collection into the array the batch route expects. */
export function buildPriceListPrices(collection: { price?: PriceInput[] }): IDataObject[] {
	return (collection?.price ?? [])
		.filter((entry) => entry.variant_id)
		.map((entry) => ({
			variant_id: entry.variant_id,
			currency_code: (entry.currency_code || 'usd').toLowerCase(),
			amount: entry.amount ?? 0,
		}));
}

async function getPrices(this: IExecuteFunctions, index: number): Promise<JsonObject[]> {
	const priceListId = this.getNodeParameter('priceListId', index) as string;
	const returnAll = this.getNodeParameter('returnAll', index, false) as boolean;
	const limit = returnAll ? 0 : (this.getNodeParameter('limit', index, 50) as number);

	return medusaApiRequestAllItems.call(this, `/admin/price-lists/${priceListId}/prices`, 'prices', {
		returnAll,
		limit,
		resource: 'price list price',
	}) as Promise<JsonObject[]>;
}

/**
 * Adds prices to a list.
 *
 * The route is a batch endpoint taking create, update and delete arrays. Only create is exposed
 * here: updating an existing price needs its price ID, which a workflow would have to fetch first,
 * and that is better handled as its own operation once someone asks for it.
 */
async function addPrices(this: IExecuteFunctions, index: number): Promise<JsonObject> {
	const priceListId = this.getNodeParameter('priceListId', index) as string;
	const prices = buildPriceListPrices(this.getNodeParameter('prices', index, {}) as never);

	if (prices.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one price is required', {
			description: 'Each price needs a variant ID, a currency and an amount.',
			itemIndex: index,
		});
	}

	return medusaApiRequest.call(this, 'POST', `/admin/price-lists/${priceListId}/prices/batch`, {
		body: { create: prices },
		resource: 'price list',
		resourceId: priceListId,
	});
}

export const priceListOperations: OperationHandlers = {
	addPrices,
	addProducts: makeAssign(config, 'products', {
		add: 'addProductIds',
		remove: 'removeProductIds',
	}),
	create: makeCreate(config, createBody),
	delete: makeDelete(config),
	get: makeGet(config),
	getAll: makeGetAll(config, buildListQuery),
	getPrices,
	update: makeUpdate(config, updateBody),
};
