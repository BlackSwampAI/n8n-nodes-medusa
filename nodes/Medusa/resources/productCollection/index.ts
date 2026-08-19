import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { listOptionsFields, paginationFields } from '../../shared/descriptions';
import {
	makeAssign,
	makeCreate,
	makeDelete,
	makeGet,
	makeGetAll,
	makeUpdate,
	type CrudConfig,
} from '../../shared/crud';
import type { OperationHandlers } from '../../shared/types';

const RESOURCE = 'productCollection';

const config: CrudConfig = {
	path: '/admin/collections',
	responseKey: 'collection',
	collectionKey: 'collections',
	resourceLabel: 'product collection',
	idParameter: 'collectionId',
};

const showFor = (operation: string) => ({ resource: [RESOURCE], operation: [operation] });

const collectionIdField = (operation: string): INodeProperties => ({
	displayName: 'Collection ID',
	name: 'collectionId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'pcol_01ABCDEF',
	displayOptions: { show: showFor(operation) },
});

const sharedFields: INodeProperties[] = [
	{
		displayName: 'Handle',
		name: 'handle',
		type: 'string',
		default: '',
		description: 'URL slug. Generated from the title when left empty.',
	},
	{
		displayName: 'Metadata',
		name: 'metadata',
		type: 'json',
		default: '{}',
		description: 'Arbitrary key-value data to store alongside the collection',
	},
];

export const collectionDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'getAll',
		displayOptions: { show: { resource: [RESOURCE] } },
		options: [
			{
				name: 'Add Products',
				value: 'addProducts',
				action: 'Add or remove products in a collection',
				description: 'Add or remove products in a collection',
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a product collection',
				description: 'Create a product collection',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a product collection',
				description: 'Delete a product collection',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a product collection',
				description: 'Retrieve a single product collection',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many product collections',
				description: 'Retrieve many product collections',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a product collection',
				description: 'Update a product collection',
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
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('create') },
		options: sharedFields,
	},

	collectionIdField('get'),
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
				placeholder: 'title,handle,*products',
				description:
					'Comma-separated list of fields to return. Prefix a relation with * to expand it.',
			},
		],
	},

	...paginationFields(RESOURCE),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: showFor('getAll') },
		options: [
			{
				displayName: 'Handle',
				name: 'handle',
				type: 'string',
				default: '',
				description: 'Return only the collection with this exact handle',
			},
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Free-text search across collection fields such as title',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'Return only collections with this exact title',
			},
		],
	},
	listOptionsFields(RESOURCE),

	collectionIdField('update'),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('update') },
		options: [
			{ displayName: 'Title', name: 'title', type: 'string', default: '' },
			...sharedFields,
		],
	},

	collectionIdField('delete'),

	collectionIdField('addProducts'),
	{
		displayName: 'Product IDs to Add',
		name: 'addProductIds',
		type: 'string',
		default: '',
		placeholder: 'prod_01ABC,prod_01DEF',
		displayOptions: { show: showFor('addProducts') },
		description: 'Comma-separated product IDs to add to the collection',
	},
	{
		displayName: 'Product IDs to Remove',
		name: 'removeProductIds',
		type: 'string',
		default: '',
		placeholder: 'prod_01GHI',
		displayOptions: { show: showFor('addProducts') },
		description: 'Comma-separated product IDs to remove from the collection',
	},
];

function createBody(context: IExecuteFunctions, index: number): IDataObject {
	return {
		title: context.getNodeParameter('title', index) as string,
		...(context.getNodeParameter('additionalFields', index, {}) as IDataObject),
	};
}

function updateBody(context: IExecuteFunctions, index: number): IDataObject {
	return { ...(context.getNodeParameter('updateFields', index, {}) as IDataObject) };
}

export function buildCollectionQuery(filters: IDataObject, options: IDataObject): IDataObject {
	const query: IDataObject = { ...filters };
	if (options.fields) query.fields = options.fields;
	if (options.order) query.order = options.order;
	return query;
}

export const collectionOperations: OperationHandlers = {
	addProducts: makeAssign(config, 'products', {
		add: 'addProductIds',
		remove: 'removeProductIds',
	}),
	create: makeCreate(config, createBody),
	delete: makeDelete(config),
	get: makeGet(config),
	getAll: makeGetAll(config, buildCollectionQuery),
	update: makeUpdate(config, updateBody),
};
