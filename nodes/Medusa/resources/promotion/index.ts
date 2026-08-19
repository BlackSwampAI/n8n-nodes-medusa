import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
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

const RESOURCE = 'promotion';

const config: CrudConfig = {
	path: '/admin/promotions',
	responseKey: 'promotion',
	collectionKey: 'promotions',
	resourceLabel: 'promotion',
	idParameter: 'promotionId',
};

const showFor = (operation: string) => ({ resource: [RESOURCE], operation: [operation] });

const promotionIdField = (operation: string): INodeProperties => ({
	displayName: 'Promotion ID',
	name: 'promotionId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'promo_01ABCDEF',
	displayOptions: { show: showFor(operation) },
});

export const promotionDescription: INodeProperties[] = [
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
				action: 'Create a promotion',
				description: 'Create a promotion',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a promotion',
				description: 'Delete a promotion',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a promotion',
				description: 'Retrieve a single promotion',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many promotions',
				description: 'Retrieve many promotions',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a promotion',
				description: 'Update a promotion',
			},
		],
	},

	{
		displayName: 'Code',
		name: 'code',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'SUMMER10',
		displayOptions: { show: showFor('create') },
		description: 'Code customers enter at checkout',
	},
	{
		displayName: 'Discount Type',
		name: 'methodType',
		type: 'options',
		required: true,
		default: 'percentage',
		displayOptions: { show: showFor('create') },
		options: [
			{ name: 'Fixed Amount', value: 'fixed' },
			{ name: 'Percentage', value: 'percentage' },
		],
	},
	{
		displayName: 'Value',
		name: 'methodValue',
		type: 'number',
		required: true,
		default: 10,
		displayOptions: { show: showFor('create') },
		description:
			'Percentage off, or a fixed amount in the currency main unit depending on the discount type',
	},
	{
		displayName: 'Applies To',
		name: 'targetType',
		type: 'options',
		required: true,
		default: 'items',
		displayOptions: { show: showFor('create') },
		options: [
			{ name: 'Items', value: 'items' },
			{ name: 'Order', value: 'order' },
			{ name: 'Shipping Methods', value: 'shipping_methods' },
		],
	},
	{
		displayName: 'Allocation',
		name: 'allocation',
		type: 'options',
		required: true,
		default: 'across',
		displayOptions: { show: showFor('create') },
		options: [
			{
				name: 'Across',
				value: 'across',
				description: 'Spread the discount over everything it applies to',
			},
			{ name: 'Each', value: 'each', description: 'Apply the discount to each item separately' },
		],
	},
	{
		displayName: 'Max Quantity',
		name: 'maxQuantity',
		type: 'number',
		required: true,
		default: 1,
		typeOptions: { minValue: 1 },
		displayOptions: { show: { ...showFor('create'), allocation: ['each'] } },
		description: 'Medusa requires this when the allocation is Each',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('create') },
		options: [
			{
				displayName: 'Campaign ID',
				name: 'campaign_id',
				type: 'string',
				default: '',
				description: 'Campaign this promotion belongs to',
			},
			{
				displayName: 'Currency Code',
				name: 'currency_code',
				type: 'string',
				default: 'usd',
				description:
					'Three-letter ISO currency code, lowercase. Required for a fixed-amount discount.',
			},
			{
				displayName: 'Is Automatic',
				name: 'is_automatic',
				type: 'boolean',
				default: false,
				description: 'Whether the promotion applies without the customer entering a code',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'draft',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Draft', value: 'draft' },
					{ name: 'Inactive', value: 'inactive' },
				],
			},
		],
	},

	promotionIdField('get'),
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
				placeholder: 'code,status,*application_method',
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
				displayName: 'Code',
				name: 'code',
				type: 'string',
				default: '',
				description: 'Return only the promotion with this exact code',
			},
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Free-text search across promotion fields such as code',
			},
		],
	},
	listOptionsFields(RESOURCE),

	promotionIdField('update'),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('update') },
		description:
			'Changing the discount itself is not supported here. Delete and recreate the promotion, or use the Medusa admin.',
		options: [
			{ displayName: 'Code', name: 'code', type: 'string', default: '' },
			{
				displayName: 'Is Automatic',
				name: 'is_automatic',
				type: 'boolean',
				default: false,
				description: 'Whether the promotion applies without the customer entering a code',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'draft',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Draft', value: 'draft' },
					{ name: 'Inactive', value: 'inactive' },
				],
			},
		],
	},

	promotionIdField('delete'),
];

/**
 * Assembles the application_method Medusa requires.
 *
 * It is built from separate fields rather than exposed as a nested object because every promotion
 * needs one, and its rules are not guessable: max_quantity is mandatory when the allocation is
 * "each" and rejected as incomplete otherwise, and a fixed-amount discount needs a currency.
 */
export function buildApplicationMethod(input: {
	type: string;
	value: number;
	targetType: string;
	allocation: string;
	maxQuantity?: number;
	currencyCode?: string;
}): IDataObject {
	const method: IDataObject = {
		type: input.type,
		target_type: input.targetType,
		allocation: input.allocation,
		value: input.value,
	};

	if (input.allocation === 'each') method.max_quantity = input.maxQuantity ?? 1;
	if (input.currencyCode) method.currency_code = input.currencyCode.toLowerCase();

	return method;
}

function createBody(context: IExecuteFunctions, index: number): IDataObject {
	const additionalFields = context.getNodeParameter('additionalFields', index, {}) as IDataObject;
	const { currency_code: currencyCode, ...rest } = additionalFields;
	const methodType = context.getNodeParameter('methodType', index) as string;

	if (methodType === 'fixed' && !currencyCode) {
		throw new NodeOperationError(
			context.getNode(),
			'A currency code is required for a fixed-amount discount',
			{
				description: 'Set Currency Code under Additional Fields.',
				itemIndex: index,
			},
		);
	}

	return {
		code: context.getNodeParameter('code', index) as string,
		type: 'standard',
		...rest,
		application_method: buildApplicationMethod({
			type: methodType,
			value: context.getNodeParameter('methodValue', index) as number,
			targetType: context.getNodeParameter('targetType', index) as string,
			allocation: context.getNodeParameter('allocation', index) as string,
			maxQuantity: context.getNodeParameter('maxQuantity', index, 1) as number,
			currencyCode: currencyCode as string | undefined,
		}),
	};
}

function updateBody(context: IExecuteFunctions, index: number): IDataObject {
	return { ...(context.getNodeParameter('updateFields', index, {}) as IDataObject) };
}

export const promotionOperations: OperationHandlers = {
	create: makeCreate(config, createBody),
	delete: makeDelete(config),
	get: makeGet(config),
	getAll: makeGetAll(config, buildListQuery),
	update: makeUpdate(config, updateBody),
};
