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
import {
	deleteLocationLevel,
	getLocationLevels,
	levelDescription,
	setLocationLevel,
} from './levels';

const RESOURCE = 'inventoryItem';

const config: CrudConfig = {
	path: '/admin/inventory-items',
	responseKey: 'inventory_item',
	collectionKey: 'inventory_items',
	resourceLabel: 'inventory item',
	idParameter: 'itemId',
};

const showFor = (operation: string) => ({ resource: [RESOURCE], operation: [operation] });

const itemIdField = (operation: string): INodeProperties => ({
	displayName: 'Inventory Item ID',
	name: 'itemId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'iitem_01ABCDEF',
	displayOptions: { show: showFor(operation) },
});

const detailFields: INodeProperties[] = [
	{ displayName: 'Description', name: 'description', type: 'string', default: '' },
	{ displayName: 'HS Code', name: 'hs_code', type: 'string', default: '' },
	{ displayName: 'Height', name: 'height', type: 'number', default: 0 },
	{ displayName: 'Length', name: 'length', type: 'number', default: 0 },
	{ displayName: 'Material', name: 'material', type: 'string', default: '' },
	{
		displayName: 'Metadata',
		name: 'metadata',
		type: 'json',
		default: '{}',
		description: 'Arbitrary key-value data to store alongside the inventory item',
	},
	{ displayName: 'MID Code', name: 'mid_code', type: 'string', default: '' },
	{ displayName: 'Origin Country', name: 'origin_country', type: 'string', default: '' },
	{
		displayName: 'Requires Shipping',
		name: 'requires_shipping',
		type: 'boolean',
		default: true,
		description: 'Whether this item has to be shipped rather than delivered digitally',
	},
	{ displayName: 'Title', name: 'title', type: 'string', default: '' },
	{ displayName: 'Weight', name: 'weight', type: 'number', default: 0 },
	{ displayName: 'Width', name: 'width', type: 'number', default: 0 },
];

export const inventoryItemDescription: INodeProperties[] = [
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
				action: 'Create an inventory item',
				description: 'Create an inventory item',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete an inventory item',
				description: 'Delete an inventory item',
			},
			{
				name: 'Delete Location Level',
				value: 'deleteLevel',
				action: 'Stop tracking an item at a location',
				description: 'Stop tracking stock for this item at a location',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an inventory item',
				description: 'Retrieve a single inventory item',
			},
			{
				name: 'Get Location Levels',
				value: 'getLevels',
				action: 'Get stock levels for an item',
				description: 'Retrieve the stock levels for this item across locations',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many inventory items',
				description: 'Retrieve many inventory items',
			},
			{
				name: 'Set Location Level',
				value: 'setLevel',
				action: 'Set stock for an item at a location',
				description: 'Set the stock for this item at a location, creating the level if needed',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update an inventory item',
				description: 'Update an inventory item',
			},
		],
	},

	{
		displayName: 'SKU',
		name: 'sku',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'CHAIR-OAK-L',
		displayOptions: { show: showFor('create') },
		description:
			'Stock keeping unit identifying this item. Medusa will accept an inventory item with no fields at all, but one without a SKU cannot be matched against a warehouse feed, so it is required here.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('create') },
		options: detailFields,
	},

	itemIdField('get'),
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
				placeholder: 'sku,title,*location_levels',
				description:
					'Comma-separated list of fields to return. Prefix a relation with * to expand it.',
			},
		],
	},

	...paginationFields(RESOURCE),
	...paginationFields(RESOURCE, 'getLevels'),
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
				description: 'Return only items created at or after this time',
			},
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Free-text search across inventory item fields such as SKU and title',
			},
			{
				displayName: 'SKU',
				name: 'sku',
				type: 'string',
				default: '',
				description: 'Return only the item with this exact SKU',
			},
			{
				displayName: 'Updated After',
				name: 'updatedAfter',
				type: 'dateTime',
				default: '',
				description: 'Return only items updated at or after this time',
			},
		],
	},
	listOptionsFields(RESOURCE),

	itemIdField('update'),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('update') },
		options: [{ displayName: 'SKU', name: 'sku', type: 'string', default: '' }, ...detailFields],
	},

	itemIdField('delete'),

	...levelDescription,
];

function createBody(context: IExecuteFunctions, index: number): IDataObject {
	return {
		sku: context.getNodeParameter('sku', index) as string,
		...(context.getNodeParameter('additionalFields', index, {}) as IDataObject),
	};
}

function updateBody(context: IExecuteFunctions, index: number): IDataObject {
	return { ...(context.getNodeParameter('updateFields', index, {}) as IDataObject) };
}

export const inventoryItemOperations: OperationHandlers = {
	create: makeCreate(config, createBody),
	delete: makeDelete(config),
	deleteLevel: deleteLocationLevel,
	get: makeGet(config),
	getAll: makeGetAll(config, buildListQuery),
	getLevels: getLocationLevels,
	setLevel: setLocationLevel,
	update: makeUpdate(config, updateBody),
};
