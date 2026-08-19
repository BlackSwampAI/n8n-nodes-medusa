import type { IDataObject, IExecuteFunctions, INodeProperties, JsonObject } from 'n8n-workflow';
import { listOptionsFields, paginationFields } from '../../shared/descriptions';
import {
	buildListQuery,
	makeAction,
	makeGet,
	makeGetAll,
	makeUpdate,
	type CrudConfig,
} from '../../shared/crud';
import { medusaApiRequest } from '../../shared/transport';
import type { OperationHandlers } from '../../shared/types';

const RESOURCE = 'order';

const config: CrudConfig = {
	path: '/admin/orders',
	responseKey: 'order',
	collectionKey: 'orders',
	resourceLabel: 'order',
	idParameter: 'orderId',
};

const showFor = (operation: string | string[]) => ({
	resource: [RESOURCE],
	operation: Array.isArray(operation) ? operation : [operation],
});

const orderIdField = (operation: string | string[]): INodeProperties => ({
	displayName: 'Order ID',
	name: 'orderId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'order_01ABCDEF',
	displayOptions: { show: showFor(operation) },
});

export const orderDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'getAll',
		displayOptions: { show: { resource: [RESOURCE] } },
		options: [
			{
				name: 'Archive',
				value: 'archive',
				action: 'Archive an order',
				description: 'Archive an order once it no longer needs attention',
			},
			{
				name: 'Cancel',
				value: 'cancel',
				action: 'Cancel an order',
				description: 'Cancel an order and its payments',
			},
			{
				name: 'Complete',
				value: 'complete',
				action: 'Complete an order',
				description: 'Mark an order complete',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an order',
				description: 'Retrieve a single order',
			},
			{
				name: 'Get Changes',
				value: 'getChanges',
				action: 'Get changes for an order',
				description: 'Retrieve the change history of an order',
			},
			{
				name: 'Get Line Items',
				value: 'getLineItems',
				action: 'Get line items for an order',
				description: 'Retrieve the line items of an order',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many orders',
				description: 'Retrieve many orders',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update an order',
				description: 'Update the email or metadata of an order',
			},
		],
	},

	orderIdField('get'),
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
				placeholder: 'status,total,email,*fulfillments',
				description:
					'Comma-separated list of fields to return. Prefix a relation with * to expand it. Some fields, including email, are not returned unless asked for by name.',
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
				description: 'Return only orders created at or after this time',
			},
			{
				displayName: 'Fulfillment Status',
				name: 'fulfillment_status',
				type: 'multiOptions',
				default: [],
				options: [
					{ name: 'Canceled', value: 'canceled' },
					{ name: 'Delivered', value: 'delivered' },
					{ name: 'Fulfilled', value: 'fulfilled' },
					{ name: 'Not Fulfilled', value: 'not_fulfilled' },
					{ name: 'Partially Delivered', value: 'partially_delivered' },
					{ name: 'Partially Fulfilled', value: 'partially_fulfilled' },
					{ name: 'Partially Shipped', value: 'partially_shipped' },
					{ name: 'Shipped', value: 'shipped' },
				],
			},
			{
				displayName: 'Payment Status',
				name: 'payment_status',
				type: 'multiOptions',
				default: [],
				options: [
					{ name: 'Authorized', value: 'authorized' },
					{ name: 'Canceled', value: 'canceled' },
					{ name: 'Captured', value: 'captured' },
					{ name: 'Not Paid', value: 'not_paid' },
					{ name: 'Partially Refunded', value: 'partially_refunded' },
					{ name: 'Refunded', value: 'refunded' },
					{ name: 'Requires Action', value: 'requires_action' },
				],
			},
			{
				displayName: 'Region ID',
				name: 'region_id',
				type: 'string',
				default: '',
				description: 'Return only orders placed in this region',
			},
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Free-text search across order fields such as email and display ID',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				default: [],
				options: [
					{ name: 'Archived', value: 'archived' },
					{ name: 'Canceled', value: 'canceled' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Draft', value: 'draft' },
					{ name: 'Pending', value: 'pending' },
					{ name: 'Requires Action', value: 'requires_action' },
				],
			},
			{
				displayName: 'Updated After',
				name: 'updatedAfter',
				type: 'dateTime',
				default: '',
				description:
					'Return only orders updated at or after this time. Useful for syncing changes since a previous run.',
			},
		],
	},
	listOptionsFields(RESOURCE),

	orderIdField('update'),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('update') },
		description:
			'Medusa only accepts a small set of fields here. Status changes go through the Cancel, Complete and Archive operations instead.',
		options: [
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
			},
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'json',
				default: '{}',
				description: 'Arbitrary key-value data to store alongside the order',
			},
		],
	},

	orderIdField(['cancel', 'complete', 'archive', 'getLineItems', 'getChanges']),
];

function updateBody(context: IExecuteFunctions, index: number): IDataObject {
	return { ...(context.getNodeParameter('updateFields', index, {}) as IDataObject) };
}

/**
 * Returns the order's line items.
 *
 * Deliberately read by expanding the order rather than from /admin/orders/{id}/line-items, which
 * returns a different entity: versioned join records whose own `id` is an `orditem_...` and whose
 * `item_id` holds the line item. Fulfillment only accepts the line item ID, so returning the join
 * records here would hand workflows IDs that fail with "Items with ids orditem_... does not exist
 * in order" the moment they reached Create Fulfillment.
 */
async function getLineItems(this: IExecuteFunctions, index: number): Promise<JsonObject[]> {
	const orderId = this.getNodeParameter('orderId', index) as string;

	const response = await medusaApiRequest.call(this, 'GET', `/admin/orders/${orderId}`, {
		query: { fields: 'id,*items' },
		resource: 'order',
		resourceId: orderId,
	});

	const order = response.order as JsonObject | undefined;
	return ((order?.items ?? []) as JsonObject[]) ?? [];
}

/** The change history of an order. This route rejects limit and offset, so it is not paged. */
async function getChanges(this: IExecuteFunctions, index: number): Promise<JsonObject[]> {
	const orderId = this.getNodeParameter('orderId', index) as string;

	const response = await medusaApiRequest.call(this, 'GET', `/admin/orders/${orderId}/changes`, {
		resource: 'order change',
		resourceId: orderId,
	});
	return ((response.order_changes ?? []) as JsonObject[]) ?? [];
}

export const orderOperations: OperationHandlers = {
	archive: makeAction(config, 'archive'),
	cancel: makeAction(config, 'cancel'),
	complete: makeAction(config, 'complete'),
	get: makeGet(config),
	getAll: makeGetAll(config, buildListQuery),
	getChanges,
	getLineItems,
	update: makeUpdate(config, updateBody),
};
