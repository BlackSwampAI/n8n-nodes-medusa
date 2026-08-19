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

const RESOURCE = 'customer';

const config: CrudConfig = {
	path: '/admin/customers',
	responseKey: 'customer',
	collectionKey: 'customers',
	resourceLabel: 'customer',
	idParameter: 'customerId',
};

const showFor = (operation: string) => ({ resource: [RESOURCE], operation: [operation] });

const customerIdField = (operation: string): INodeProperties => ({
	displayName: 'Customer ID',
	name: 'customerId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'cus_01ABCDEF',
	displayOptions: { show: showFor(operation) },
});

const profileFields: INodeProperties[] = [
	{ displayName: 'Company Name', name: 'company_name', type: 'string', default: '' },
	{ displayName: 'First Name', name: 'first_name', type: 'string', default: '' },
	{ displayName: 'Last Name', name: 'last_name', type: 'string', default: '' },
	{
		displayName: 'Metadata',
		name: 'metadata',
		type: 'json',
		default: '{}',
		description: 'Arbitrary key-value data to store alongside the customer',
	},
	{ displayName: 'Phone', name: 'phone', type: 'string', default: '' },
];

export const customerDescription: INodeProperties[] = [
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
				action: 'Create a customer',
				description: 'Create a customer',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a customer',
				description: 'Delete a customer',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a customer',
				description: 'Retrieve a single customer',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many customers',
				description: 'Retrieve many customers',
			},
			{
				name: 'Set Groups',
				value: 'setGroups',
				action: 'Add or remove a customer from groups',
				description: 'Add or remove a customer from customer groups',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a customer',
				description: 'Update a customer',
			},
		],
	},

	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		displayOptions: { show: showFor('create') },
		description:
			'Email address of the customer. Medusa will accept a customer with no fields at all, but one without an email cannot be contacted or matched against an existing record, so it is required here.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('create') },
		options: profileFields,
	},

	customerIdField('get'),
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
				placeholder: 'email,first_name,*groups',
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
				displayName: 'Company Name',
				name: 'company_name',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Created After',
				name: 'createdAfter',
				type: 'dateTime',
				default: '',
				description: 'Return only customers created at or after this time',
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				description: 'Return only the customer with this exact email address',
			},
			{
				displayName: 'Has Account',
				name: 'has_account',
				type: 'boolean',
				default: true,
				description:
					'Whether to return only registered customers. Guests who checked out without registering have no account.',
			},
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Free-text search across customer fields such as email and name',
			},
			{
				displayName: 'Updated After',
				name: 'updatedAfter',
				type: 'dateTime',
				default: '',
				description:
					'Return only customers updated at or after this time. Useful for syncing changes since a previous run.',
			},
		],
	},
	listOptionsFields(RESOURCE),

	customerIdField('update'),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('update') },
		options: [
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
			},
			...profileFields,
		],
	},

	customerIdField('delete'),

	customerIdField('setGroups'),
	{
		displayName: 'Group IDs to Add',
		name: 'addGroupIds',
		type: 'string',
		default: '',
		placeholder: 'cusgroup_01ABC,cusgroup_01DEF',
		displayOptions: { show: showFor('setGroups') },
		description: 'Comma-separated customer group IDs to add this customer to',
	},
	{
		displayName: 'Group IDs to Remove',
		name: 'removeGroupIds',
		type: 'string',
		default: '',
		placeholder: 'cusgroup_01GHI',
		displayOptions: { show: showFor('setGroups') },
		description: 'Comma-separated customer group IDs to remove this customer from',
	},
];

function createBody(context: IExecuteFunctions, index: number): IDataObject {
	return {
		email: context.getNodeParameter('email', index) as string,
		...(context.getNodeParameter('additionalFields', index, {}) as IDataObject),
	};
}

function updateBody(context: IExecuteFunctions, index: number): IDataObject {
	return { ...(context.getNodeParameter('updateFields', index, {}) as IDataObject) };
}

export const customerOperations: OperationHandlers = {
	create: makeCreate(config, createBody),
	delete: makeDelete(config),
	get: makeGet(config),
	getAll: makeGetAll(config, buildListQuery),
	setGroups: makeAssign(config, 'customer-groups', {
		add: 'addGroupIds',
		remove: 'removeGroupIds',
	}),
	update: makeUpdate(config, updateBody),
};
