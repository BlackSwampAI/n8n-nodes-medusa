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

const RESOURCE = 'productCategory';

const config: CrudConfig = {
	path: '/admin/product-categories',
	responseKey: 'product_category',
	collectionKey: 'product_categories',
	resourceLabel: 'product category',
	idParameter: 'categoryId',
};

const showFor = (operation: string) => ({ resource: [RESOURCE], operation: [operation] });

const categoryIdField = (operation: string): INodeProperties => ({
	displayName: 'Category ID',
	name: 'categoryId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'pcat_01ABCDEF',
	displayOptions: { show: showFor(operation) },
});

const sharedFields: INodeProperties[] = [
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: { rows: 2 },
		default: '',
	},
	{
		displayName: 'Handle',
		name: 'handle',
		type: 'string',
		default: '',
		description: 'URL slug. Generated from the name when left empty.',
	},
	{
		displayName: 'Is Active',
		name: 'is_active',
		type: 'boolean',
		default: false,
		description:
			'Whether the category is visible to customers. Medusa creates categories inactive, so this must be turned on for the category to appear in a storefront.',
	},
	{
		displayName: 'Is Internal',
		name: 'is_internal',
		type: 'boolean',
		default: false,
		description: 'Whether the category is for internal use and hidden from customers',
	},
	{
		displayName: 'Metadata',
		name: 'metadata',
		type: 'json',
		default: '{}',
		description: 'Arbitrary key-value data to store alongside the category',
	},
	{
		displayName: 'Parent Category ID',
		name: 'parent_category_id',
		type: 'string',
		default: '',
		description: 'Nests this category beneath another one',
	},
	{
		displayName: 'Rank',
		name: 'rank',
		type: 'number',
		default: 0,
		description: 'Position among sibling categories',
	},
];

export const categoryDescription: INodeProperties[] = [
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
				action: 'Add or remove products in a category',
				description: 'Add or remove products in a category',
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a product category',
				description: 'Create a product category',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a product category',
				description: 'Delete a product category',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a product category',
				description: 'Retrieve a single product category',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many product categories',
				description: 'Retrieve many product categories',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a product category',
				description: 'Update a product category',
			},
		],
	},

	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Outdoor Furniture',
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

	categoryIdField('get'),
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
				placeholder: 'name,handle,*products',
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
				description: 'Return only the category with this exact handle',
			},
			{
				displayName: 'Is Active',
				name: 'is_active',
				type: 'boolean',
				default: true,
				description: 'Whether to return only categories that are visible to customers',
			},
			{
				displayName: 'Is Internal',
				name: 'is_internal',
				type: 'boolean',
				default: false,
				description: 'Whether to return only categories marked internal',
			},
			{
				displayName: 'Parent Category ID',
				name: 'parent_category_id',
				type: 'string',
				default: '',
				description: 'Return only categories nested beneath this one',
			},
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Free-text search across category fields such as name and description',
			},
		],
	},
	listOptionsFields(RESOURCE),

	categoryIdField('update'),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('update') },
		options: [{ displayName: 'Name', name: 'name', type: 'string', default: '' }, ...sharedFields],
	},

	categoryIdField('delete'),

	categoryIdField('addProducts'),
	{
		displayName: 'Product IDs to Add',
		name: 'addProductIds',
		type: 'string',
		default: '',
		placeholder: 'prod_01ABC,prod_01DEF',
		displayOptions: { show: showFor('addProducts') },
		description: 'Comma-separated product IDs to add to the category',
	},
	{
		displayName: 'Product IDs to Remove',
		name: 'removeProductIds',
		type: 'string',
		default: '',
		placeholder: 'prod_01GHI',
		displayOptions: { show: showFor('addProducts') },
		description: 'Comma-separated product IDs to remove from the category',
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

export function buildCategoryQuery(filters: IDataObject, options: IDataObject): IDataObject {
	const query: IDataObject = { ...filters };
	if (options.fields) query.fields = options.fields;
	if (options.order) query.order = options.order;
	return query;
}

export const categoryOperations: OperationHandlers = {
	addProducts: makeAssign(config, 'products', {
		add: 'addProductIds',
		remove: 'removeProductIds',
	}),
	create: makeCreate(config, createBody),
	delete: makeDelete(config),
	get: makeGet(config),
	getAll: makeGetAll(config, buildCategoryQuery),
	update: makeUpdate(config, updateBody),
};
