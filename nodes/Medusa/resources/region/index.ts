import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { listOptionsFields, paginationFields } from '../../shared/descriptions';
import {
	buildListQuery,
	makeCreate,
	makeDelete,
	makeGet,
	makeGetAll,
	makeUpdate,
	type CrudConfig,
} from '../../shared/crud';
import type { OperationHandlers } from '../../shared/types';

const RESOURCE = 'region';

const config: CrudConfig = {
	path: '/admin/regions',
	responseKey: 'region',
	collectionKey: 'regions',
	resourceLabel: 'region',
	idParameter: 'regionId',
};

const showFor = (operation: string) => ({ resource: [RESOURCE], operation: [operation] });

const regionIdField = (operation: string): INodeProperties => ({
	displayName: 'Region ID',
	name: 'regionId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'reg_01ABCDEF',
	displayOptions: { show: showFor(operation) },
});

const countriesField: INodeProperties = {
	displayName: 'Countries',
	name: 'countries',
	type: 'string',
	default: '',
	placeholder: 'us,ca',
	description:
		'Comma-separated two-letter ISO country codes, lowercase. A country belongs to exactly one region, so assigning one that another region already covers is rejected.',
};

const sharedFields: INodeProperties[] = [
	{
		displayName: 'Automatic Taxes',
		name: 'automatic_taxes',
		type: 'boolean',
		default: true,
		description: 'Whether taxes are calculated automatically for this region',
	},
	countriesField,
	{
		displayName: 'Metadata',
		name: 'metadata',
		type: 'json',
		default: '{}',
		description: 'Arbitrary key-value data to store alongside the region',
	},
];

export const regionDescription: INodeProperties[] = [
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
				action: 'Create a region',
				description: 'Create a region',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a region',
				description: 'Delete a region',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a region',
				description: 'Retrieve a single region',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many regions',
				description: 'Retrieve many regions',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a region',
				description: 'Update a region',
			},
		],
	},

	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'North America',
		displayOptions: { show: showFor('create') },
	},
	{
		displayName: 'Currency Code',
		name: 'currency_code',
		type: 'string',
		required: true,
		default: 'usd',
		placeholder: 'usd',
		displayOptions: { show: showFor('create') },
		description: 'Three-letter ISO currency code, lowercase',
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

	regionIdField('get'),
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
				placeholder: 'name,currency_code,*countries',
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
				displayName: 'Currency Code',
				name: 'currency_code',
				type: 'string',
				default: '',
				description: 'Return only regions using this currency',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Return only regions with this exact name',
			},
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Free-text search across region fields such as name',
			},
		],
	},
	listOptionsFields(RESOURCE),

	regionIdField('update'),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('update') },
		options: [
			{ displayName: 'Name', name: 'name', type: 'string', default: '' },
			{
				displayName: 'Currency Code',
				name: 'currency_code',
				type: 'string',
				default: '',
				description: 'Three-letter ISO currency code, lowercase',
			},
			...sharedFields,
		],
	},

	regionIdField('delete'),
];

/** Countries arrive as a comma-separated string and have to be sent as an array. */
function splitCountries(fields: IDataObject): IDataObject {
	const { countries, ...rest } = fields;
	if (typeof countries !== 'string' || countries.trim() === '') return rest;

	return {
		...rest,
		countries: countries
			.split(',')
			.map((code) => code.trim().toLowerCase())
			.filter(Boolean),
	};
}

function createBody(context: IExecuteFunctions, index: number): IDataObject {
	return {
		name: context.getNodeParameter('name', index) as string,
		currency_code: (context.getNodeParameter('currency_code', index) as string).toLowerCase(),
		...splitCountries(context.getNodeParameter('additionalFields', index, {}) as IDataObject),
	};
}

function updateBody(context: IExecuteFunctions, index: number): IDataObject {
	return splitCountries(context.getNodeParameter('updateFields', index, {}) as IDataObject);
}

export const regionOperations: OperationHandlers = {
	create: makeCreate(config, createBody),
	delete: makeDelete(config),
	get: makeGet(config),
	getAll: makeGetAll(config, buildListQuery),
	update: makeUpdate(config, updateBody),
};
