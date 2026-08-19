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

const RESOURCE = 'customerGroup';

const config: CrudConfig = {
	path: '/admin/customer-groups',
	responseKey: 'customer_group',
	collectionKey: 'customer_groups',
	resourceLabel: 'customer group',
	idParameter: 'groupId',
};

const showFor = (operation: string) => ({ resource: [RESOURCE], operation: [operation] });

const groupIdField = (operation: string): INodeProperties => ({
	displayName: 'Group ID',
	name: 'groupId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'cusgroup_01ABCDEF',
	displayOptions: { show: showFor(operation) },
});

const metadataField: INodeProperties = {
	displayName: 'Metadata',
	name: 'metadata',
	type: 'json',
	default: '{}',
	description: 'Arbitrary key-value data to store alongside the group',
};

export const customerGroupDescription: INodeProperties[] = [
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
				action: 'Create a customer group',
				description: 'Create a customer group',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a customer group',
				description: 'Delete a customer group',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a customer group',
				description: 'Retrieve a single customer group',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many customer groups',
				description: 'Retrieve many customer groups',
			},
			{
				name: 'Set Customers',
				value: 'setCustomers',
				action: 'Add or remove customers in a group',
				description: 'Add or remove customers in a customer group',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a customer group',
				description: 'Update a customer group',
			},
		],
	},

	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'VIP Customers',
		displayOptions: { show: showFor('create') },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('create') },
		options: [metadataField],
	},

	groupIdField('get'),
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
				placeholder: 'name,*customers',
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
				displayName: 'Created After',
				name: 'createdAfter',
				type: 'dateTime',
				default: '',
				description: 'Return only groups created at or after this time',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Return only groups with this exact name',
			},
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Free-text search across group fields such as name',
			},
		],
	},
	listOptionsFields(RESOURCE),

	groupIdField('update'),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('update') },
		options: [{ displayName: 'Name', name: 'name', type: 'string', default: '' }, metadataField],
	},

	groupIdField('delete'),

	groupIdField('setCustomers'),
	{
		displayName: 'Customer IDs to Add',
		name: 'addCustomerIds',
		type: 'string',
		default: '',
		placeholder: 'cus_01ABC,cus_01DEF',
		displayOptions: { show: showFor('setCustomers') },
		description: 'Comma-separated customer IDs to add to the group',
	},
	{
		displayName: 'Customer IDs to Remove',
		name: 'removeCustomerIds',
		type: 'string',
		default: '',
		placeholder: 'cus_01GHI',
		displayOptions: { show: showFor('setCustomers') },
		description: 'Comma-separated customer IDs to remove from the group',
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

export const customerGroupOperations: OperationHandlers = {
	create: makeCreate(config, createBody),
	delete: makeDelete(config),
	get: makeGet(config),
	getAll: makeGetAll(config, buildListQuery),
	setCustomers: makeAssign(config, 'customers', {
		add: 'addCustomerIds',
		remove: 'removeCustomerIds',
	}),
	update: makeUpdate(config, updateBody),
};
