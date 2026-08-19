import type { IDataObject, IExecuteFunctions, INodeProperties, JsonObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { medusaApiRequest } from '../../shared/transport';
import type { OperationHandlers } from '../../shared/types';

const RESOURCE = 'fulfillment';

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
	description: 'Order this fulfillment belongs to. Fulfillments are always addressed through one.',
});

const fulfillmentIdField = (operation: string | string[]): INodeProperties => ({
	displayName: 'Fulfillment ID',
	name: 'fulfillmentId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'ful_01ABCDEF',
	displayOptions: { show: showFor(operation) },
});

const itemsField = (operation: string, description: string): INodeProperties => ({
	displayName: 'Items',
	name: 'items',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true, sortable: true },
	required: true,
	default: {},
	displayOptions: { show: showFor(operation) },
	description,
	options: [
		{
			displayName: 'Item',
			name: 'item',
			values: [
				{
					displayName: 'Line Item ID',
					name: 'id',
					type: 'string',
					default: '',
					required: true,
					placeholder: 'ordli_01ABCDEF',
					description:
						'Order line item to include. Use the Order resource Get Line Items operation to find these.',
				},
				{
					displayName: 'Quantity',
					name: 'quantity',
					type: 'number',
					default: 1,
					required: true,
					typeOptions: { minValue: 1 },
				},
			],
		},
	],
});

export const fulfillmentDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'getAll',
		displayOptions: { show: { resource: [RESOURCE] } },
		options: [
			{
				name: 'Cancel',
				value: 'cancel',
				action: 'Cancel a fulfillment',
				description: 'Cancel a fulfillment that has not shipped',
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a fulfillment',
				description: 'Fulfill items on an order',
			},
			{
				name: 'Create Shipment',
				value: 'createShipment',
				action: 'Mark a fulfillment shipped',
				description: 'Record that a fulfillment has shipped',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many fulfillments for an order',
				description: 'Retrieve the fulfillments of an order',
			},
			{
				name: 'Mark as Delivered',
				value: 'markDelivered',
				action: 'Mark a fulfillment delivered',
				description: 'Record that a fulfillment has been delivered',
			},
		],
	},

	orderIdField(['create', 'cancel', 'createShipment', 'markDelivered', 'getAll']),
	itemsField('create', 'Order line items to fulfill, and how many of each'),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('create') },
		options: [
			{
				displayName: 'Location ID',
				name: 'location_id',
				type: 'string',
				default: '',
				description: 'Stock location the items ship from',
			},
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'json',
				default: '{}',
			},
			{
				displayName: 'Suppress Notification',
				name: 'no_notification',
				type: 'boolean',
				default: false,
				description: 'Whether to skip notifying the customer about this fulfillment',
			},
		],
	},

	fulfillmentIdField(['cancel', 'createShipment', 'markDelivered']),
	itemsField('createShipment', 'Order line items included in this shipment, and how many of each'),
];

interface ItemInput {
	id?: string;
	quantity?: number;
}

/** Turns the Items collection into the array Medusa expects. */
export function buildFulfillmentItems(collection: { item?: ItemInput[] }): IDataObject[] {
	return (collection?.item ?? [])
		.filter((entry) => entry.id)
		.map((entry) => ({ id: entry.id, quantity: entry.quantity ?? 1 }));
}

/** Reads an order's fulfillments, which is only possible by expanding them from the order. */
async function readFulfillments(
	context: IExecuteFunctions,
	orderId: string,
): Promise<JsonObject[]> {
	const response = await medusaApiRequest.call(context, 'GET', `/admin/orders/${orderId}`, {
		query: { fields: 'id,*fulfillments' },
		resource: 'order',
		resourceId: orderId,
	});
	const order = response.order as JsonObject | undefined;
	return ((order?.fulfillments ?? []) as JsonObject[]) ?? [];
}

/**
 * Lists the fulfillments on an order.
 *
 * Medusa has no read route for fulfillments at all — `/admin/fulfillments` is three write-only
 * endpoints — so this expands them from the order instead.
 */
export async function getAllFulfillments(
	this: IExecuteFunctions,
	index: number,
): Promise<JsonObject[]> {
	const orderId = this.getNodeParameter('orderId', index) as string;
	return readFulfillments(this, orderId);
}

/**
 * Fulfills items on an order.
 *
 * Medusa answers with the order rather than the fulfillment, and does not expand fulfillments in
 * that response, so the order is read back to find the one just created. It is identified as the
 * newest, since a create adds exactly one.
 */
export async function createFulfillment(
	this: IExecuteFunctions,
	index: number,
): Promise<JsonObject> {
	const orderId = this.getNodeParameter('orderId', index) as string;
	const items = buildFulfillmentItems(this.getNodeParameter('items', index, {}) as never);
	const additionalFields = this.getNodeParameter('additionalFields', index, {}) as IDataObject;

	if (items.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one item is required', {
			description: 'A fulfillment has to say which line items it covers.',
			itemIndex: index,
		});
	}

	const body: IDataObject = { items, ...additionalFields };
	if (typeof body.metadata === 'string') {
		try {
			body.metadata = JSON.parse(body.metadata);
		} catch {
			throw new NodeOperationError(this.getNode(), 'Metadata is not valid JSON', {
				itemIndex: index,
			});
		}
	}

	await medusaApiRequest.call(this, 'POST', `/admin/orders/${orderId}/fulfillments`, {
		body,
		resource: 'fulfillment',
		resourceId: orderId,
	});

	const fulfillments = await readFulfillments(this, orderId);
	return (
		fulfillments.reduce<JsonObject | undefined>(
			(newest, candidate) =>
				!newest || String(candidate.created_at ?? '') >= String(newest.created_at ?? '')
					? candidate
					: newest,
			undefined,
		) ?? ({ order_id: orderId } as JsonObject)
	);
}

export async function cancelFulfillment(
	this: IExecuteFunctions,
	index: number,
): Promise<JsonObject> {
	const orderId = this.getNodeParameter('orderId', index) as string;
	const fulfillmentId = this.getNodeParameter('fulfillmentId', index) as string;

	// Medusa refuses once a fulfillment has shipped, answering 400 with a not_allowed message.
	// That wording is clearer than anything generic, so it passes through unchanged.
	const response = await medusaApiRequest.call(
		this,
		'POST',
		`/admin/orders/${orderId}/fulfillments/${fulfillmentId}/cancel`,
		{ body: {}, resource: 'fulfillment', resourceId: fulfillmentId },
	);
	return (response.order ?? response) as JsonObject;
}

export async function createShipment(this: IExecuteFunctions, index: number): Promise<JsonObject> {
	const orderId = this.getNodeParameter('orderId', index) as string;
	const fulfillmentId = this.getNodeParameter('fulfillmentId', index) as string;
	const items = buildFulfillmentItems(this.getNodeParameter('items', index, {}) as never);

	if (items.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one item is required', {
			description: 'Medusa rejects a shipment that does not say what was shipped.',
			itemIndex: index,
		});
	}

	const response = await medusaApiRequest.call(
		this,
		'POST',
		`/admin/orders/${orderId}/fulfillments/${fulfillmentId}/shipments`,
		{ body: { items }, resource: 'fulfillment', resourceId: fulfillmentId },
	);
	return (response.order ?? response) as JsonObject;
}

export async function markDelivered(this: IExecuteFunctions, index: number): Promise<JsonObject> {
	const orderId = this.getNodeParameter('orderId', index) as string;
	const fulfillmentId = this.getNodeParameter('fulfillmentId', index) as string;

	const response = await medusaApiRequest.call(
		this,
		'POST',
		`/admin/orders/${orderId}/fulfillments/${fulfillmentId}/mark-as-delivered`,
		{ body: {}, resource: 'fulfillment', resourceId: fulfillmentId },
	);
	return (response.order ?? response) as JsonObject;
}

export const fulfillmentOperations: OperationHandlers = {
	cancel: cancelFulfillment,
	create: createFulfillment,
	createShipment,
	getAll: getAllFulfillments,
	markDelivered,
};
