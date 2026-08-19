import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
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
import type { OperationHandlers } from '../../shared/types';

const RESOURCE = 'salesChannel';

const config: CrudConfig = {
	path: '/admin/sales-channels',
	responseKey: 'sales_channel',
	collectionKey: 'sales_channels',
	resourceLabel: 'sales channel',
	idParameter: 'channelId',
};

const showFor = (operation: string) => ({ resource: [RESOURCE], operation: [operation] });

const channelIdField = (operation: string): INodeProperties => ({
	displayName: 'Sales Channel ID',
	name: 'channelId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'sc_01ABCDEF',
	displayOptions: { show: showFor(operation) },
});

const sharedFields: INodeProperties[] = [
	{ displayName: 'Description', name: 'description', type: 'string', default: '' },
	{
		displayName: 'Is Disabled',
		name: 'is_disabled',
		type: 'boolean',
		default: false,
		description: 'Whether the channel is switched off and stops serving products',
	},
	{
		displayName: 'Metadata',
		name: 'metadata',
		type: 'json',
		default: '{}',
		description: 'Arbitrary key-value data to store alongside the channel',
	},
];

export const salesChannelDescription: INodeProperties[] = [
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
				action: 'Add or remove products in a sales channel',
				description: 'Add or remove products in a sales channel',
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a sales channel',
				description: 'Create a sales channel',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a sales channel',
				description: 'Delete a sales channel',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a sales channel',
				description: 'Retrieve a single sales channel',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many sales channels',
				description: 'Retrieve many sales channels',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a sales channel',
				description: 'Update a sales channel',
			},
		],
	},

	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Webshop',
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

	channelIdField('get'),
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
				placeholder: 'name,description,*products',
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
				displayName: 'Is Disabled',
				name: 'is_disabled',
				type: 'boolean',
				default: false,
				description: 'Whether to return only channels that are switched off',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Return only channels with this exact name',
			},
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Free-text search across sales channel fields such as name',
			},
		],
	},
	listOptionsFields(RESOURCE),

	channelIdField('update'),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('update') },
		options: [{ displayName: 'Name', name: 'name', type: 'string', default: '' }, ...sharedFields],
	},

	channelIdField('delete'),

	channelIdField('addProducts'),
	{
		displayName: 'Product IDs to Add',
		name: 'addProductIds',
		type: 'string',
		default: '',
		placeholder: 'prod_01ABC,prod_01DEF',
		displayOptions: { show: showFor('addProducts') },
		description: 'Comma-separated product IDs to make available in this channel',
	},
	{
		displayName: 'Product IDs to Remove',
		name: 'removeProductIds',
		type: 'string',
		default: '',
		placeholder: 'prod_01GHI',
		displayOptions: { show: showFor('addProducts') },
		description: 'Comma-separated product IDs to remove from this channel',
	},
];

function createBody(context: IExecuteFunctions, index: number): IDataObject {
	return {
		name: context.getNodeParameter('name', index) as string,
		...(context.getNodeParameter('additionalFields', index, {}) as IDataObject),
	};
}

function updateBody(context: IExecuteFunctions, index: number): IDataObject {
	return { ...(context.getNodeParameter('updateFields', index, {}) as IDataObject) };
}

export const salesChannelOperations: OperationHandlers = {
	addProducts: makeAssign(config, 'products', {
		add: 'addProductIds',
		remove: 'removeProductIds',
	}),
	create: makeCreate(config, createBody),
	delete: makeDelete(config),
	get: makeGet(config),
	getAll: makeGetAll(config, buildListQuery),
	update: makeUpdate(config, updateBody),
};
