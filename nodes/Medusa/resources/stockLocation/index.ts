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

const RESOURCE = 'stockLocation';

const config: CrudConfig = {
	path: '/admin/stock-locations',
	responseKey: 'stock_location',
	collectionKey: 'stock_locations',
	resourceLabel: 'stock location',
	idParameter: 'locationId',
};

const showFor = (operation: string) => ({ resource: [RESOURCE], operation: [operation] });

const locationIdField = (operation: string): INodeProperties => ({
	displayName: 'Stock Location ID',
	name: 'locationId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'sloc_01ABCDEF',
	displayOptions: { show: showFor(operation) },
});

const addressField: INodeProperties = {
	displayName: 'Address',
	name: 'address',
	type: 'fixedCollection',
	default: {},
	description: 'Physical address of this location',
	options: [
		{
			displayName: 'Address',
			name: 'address',
			values: [
				{
					displayName: 'Address Line 1',
					name: 'address_1',
					type: 'string',
					default: '',
					required: true,
				},
				{ displayName: 'Address Line 2', name: 'address_2', type: 'string', default: '' },
				{ displayName: 'City', name: 'city', type: 'string', default: '' },
				{
					displayName: 'Country Code',
					name: 'country_code',
					type: 'string',
					default: '',
					required: true,
					placeholder: 'us',
					description: 'Two-letter ISO country code, lowercase',
				},
				{ displayName: 'Postal Code', name: 'postal_code', type: 'string', default: '' },
				{ displayName: 'Province', name: 'province', type: 'string', default: '' },
				{ displayName: 'Phone', name: 'phone', type: 'string', default: '' },
			],
		},
	],
};

const metadataField: INodeProperties = {
	displayName: 'Metadata',
	name: 'metadata',
	type: 'json',
	default: '{}',
	description: 'Arbitrary key-value data to store alongside the location',
};

export const stockLocationDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'getAll',
		displayOptions: { show: { resource: [RESOURCE] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a stock location',
				description: 'Create a stock location',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a stock location',
				description: 'Delete a stock location',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a stock location',
				description: 'Retrieve a single stock location',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many stock locations',
				description: 'Retrieve many stock locations',
			},
			{
				name: 'Set Sales Channels',
				value: 'setSalesChannels',
				action: 'Add or remove sales channels for a location',
				description: 'Add or remove the sales channels this location serves',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a stock location',
				description: 'Update a stock location',
			},
		],
	},

	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Toledo Warehouse',
		displayOptions: { show: showFor('create') },
		description:
			'Name of the location. Required: Medusa answers with a server error rather than a validation message when it is missing.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('create') },
		options: [addressField, metadataField],
	},

	locationIdField('get'),
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
				placeholder: 'name,*address,*sales_channels',
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
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Return only locations with this exact name',
			},
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Free-text search across stock location fields such as name',
			},
		],
	},
	listOptionsFields(RESOURCE),

	locationIdField('update'),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('update') },
		options: [
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			addressField,
			metadataField,
		],
	},

	locationIdField('delete'),

	locationIdField('setSalesChannels'),
	{
		displayName: 'Sales Channel IDs to Add',
		name: 'addChannelIds',
		type: 'string',
		default: '',
		placeholder: 'sc_01ABC,sc_01DEF',
		displayOptions: { show: showFor('setSalesChannels') },
		description: 'Comma-separated sales channel IDs this location should serve',
	},
	{
		displayName: 'Sales Channel IDs to Remove',
		name: 'removeChannelIds',
		type: 'string',
		default: '',
		placeholder: 'sc_01GHI',
		displayOptions: { show: showFor('setSalesChannels') },
		description: 'Comma-separated sales channel IDs this location should stop serving',
	},
];

/** The address arrives from a fixedCollection and has to be unwrapped before sending. */
function flattenAddress(fields: IDataObject): IDataObject {
	const { address, ...rest } = fields;
	if (!address) return rest;

	const inner = (address as { address?: IDataObject }).address;
	return inner ? { ...rest, address: inner } : rest;
}

function createBody(context: IExecuteFunctions, index: number): IDataObject {
	return {
		name: context.getNodeParameter('name', index) as string,
		...flattenAddress(context.getNodeParameter('additionalFields', index, {}) as IDataObject),
	};
}

function updateBody(context: IExecuteFunctions, index: number): IDataObject {
	return flattenAddress(context.getNodeParameter('updateFields', index, {}) as IDataObject);
}

export const stockLocationOperations: OperationHandlers = {
	create: makeCreate(config, createBody),
	delete: makeDelete(config),
	get: makeGet(config),
	getAll: makeGetAll(config, buildListQuery),
	setSalesChannels: makeAssign(config, 'sales-channels', {
		add: 'addChannelIds',
		remove: 'removeChannelIds',
	}),
	update: makeUpdate(config, updateBody),
};
