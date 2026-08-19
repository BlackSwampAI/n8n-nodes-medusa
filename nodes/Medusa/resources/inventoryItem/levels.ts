import type { IDataObject, IExecuteFunctions, INodeProperties, JsonObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { medusaApiRequest, medusaApiRequestAllItems } from '../../shared/transport';

const RESOURCE = 'inventoryItem';
const showFor = (operation: string) => ({ resource: [RESOURCE], operation: [operation] });

const inventoryItemIdField = (operation: string): INodeProperties => ({
	displayName: 'Inventory Item ID',
	name: 'inventoryItemId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'iitem_01ABCDEF',
	displayOptions: { show: showFor(operation) },
});

const locationIdField = (operation: string): INodeProperties => ({
	displayName: 'Stock Location ID',
	name: 'locationId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'sloc_01ABCDEF',
	displayOptions: { show: showFor(operation) },
});

export const levelDescription: INodeProperties[] = [
	inventoryItemIdField('getLevels'),

	inventoryItemIdField('setLevel'),
	locationIdField('setLevel'),
	{
		displayName: 'Stocked Quantity',
		name: 'stockedQuantity',
		type: 'number',
		required: true,
		default: 0,
		typeOptions: { minValue: 0 },
		displayOptions: { show: showFor('setLevel') },
		description: 'Units physically held at this location',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor('setLevel') },
		options: [
			{
				displayName: 'Incoming Quantity',
				name: 'incoming_quantity',
				type: 'number',
				default: 0,
				typeOptions: { minValue: 0 },
				description: 'Units expected to arrive at this location',
			},
		],
	},

	inventoryItemIdField('deleteLevel'),
	{
		...locationIdField('deleteLevel'),
		description:
			'Stock location to stop tracking this item at. Medusa refuses while stock remains, so set the stocked quantity to 0 first.',
	},
];

/** Reads the stock levels an inventory item has across locations. */
export async function getLocationLevels(
	this: IExecuteFunctions,
	index: number,
): Promise<JsonObject[]> {
	const inventoryItemId = this.getNodeParameter('inventoryItemId', index) as string;
	const returnAll = this.getNodeParameter('returnAll', index, false) as boolean;
	const limit = returnAll ? 0 : (this.getNodeParameter('limit', index, 50) as number);

	return medusaApiRequestAllItems.call(
		this,
		`/admin/inventory-items/${inventoryItemId}/location-levels`,
		'inventory_levels',
		{ returnAll, limit, resource: 'inventory level' },
	) as Promise<JsonObject[]>;
}

/**
 * Sets the stock for one item at one location, creating the level if it does not exist yet.
 *
 * Medusa splits this across two routes — POST .../location-levels creates, and
 * POST .../location-levels/{location_id} updates — and creating one that already exists fails.
 * A warehouse feed does not know which case it is in, so the node checks first and picks. That
 * costs one extra request, and is preferred over creating and then interpreting the failure
 * message, which would break the moment Medusa reworded it.
 */
export async function setLocationLevel(
	this: IExecuteFunctions,
	index: number,
): Promise<JsonObject> {
	const inventoryItemId = this.getNodeParameter('inventoryItemId', index) as string;
	const locationId = this.getNodeParameter('locationId', index) as string;
	const stockedQuantity = this.getNodeParameter('stockedQuantity', index) as number;
	const additionalFields = this.getNodeParameter('additionalFields', index, {}) as IDataObject;

	const basePath = `/admin/inventory-items/${inventoryItemId}/location-levels`;

	const existing = (await medusaApiRequest.call(this, 'GET', basePath, {
		query: { location_id: [locationId], limit: 1 },
		resource: 'inventory level',
		resourceId: inventoryItemId,
	})) as { inventory_levels?: JsonObject[] };

	const alreadyTracked = (existing.inventory_levels ?? []).some(
		(level) => level.location_id === locationId,
	);

	const response = alreadyTracked
		? await medusaApiRequest.call(this, 'POST', `${basePath}/${locationId}`, {
				body: { stocked_quantity: stockedQuantity, ...additionalFields },
				resource: 'inventory level',
				resourceId: locationId,
			})
		: await medusaApiRequest.call(this, 'POST', basePath, {
				body: {
					location_id: locationId,
					stocked_quantity: stockedQuantity,
					...additionalFields,
				},
				resource: 'inventory level',
				resourceId: inventoryItemId,
			});

	// Both routes answer with the parent inventory item, which embeds the levels. The level that
	// was just written is more useful to a workflow than the whole item.
	const item = response.inventory_item as JsonObject | undefined;
	const levels = (item?.location_levels ?? []) as JsonObject[];
	return levels.find((level) => level.location_id === locationId) ?? (item as JsonObject);
}

/** Stops tracking an inventory item at a location. */
export async function deleteLocationLevel(
	this: IExecuteFunctions,
	index: number,
): Promise<JsonObject> {
	const inventoryItemId = this.getNodeParameter('inventoryItemId', index) as string;
	const locationId = this.getNodeParameter('locationId', index) as string;

	if (!locationId) {
		throw new NodeOperationError(this.getNode(), 'A stock location ID is required', {
			itemIndex: index,
		});
	}

	// Medusa refuses while stock remains, answering 400 with a not_allowed message that names the
	// location. That message is passed through unchanged; it is clearer than anything generic.
	return medusaApiRequest.call(
		this,
		'DELETE',
		`/admin/inventory-items/${inventoryItemId}/location-levels/${locationId}`,
		{ resource: 'inventory level', resourceId: locationId },
	);
}
