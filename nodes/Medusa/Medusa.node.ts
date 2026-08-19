import {
	NodeConnectionTypes,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { productDescription } from './resources/product';
import { variantDescription } from './resources/productVariant';
import { categoryDescription } from './resources/productCategory';
import { collectionDescription } from './resources/productCollection';
import { customerDescription } from './resources/customer';
import { customerGroupDescription } from './resources/customerGroup';
import { inventoryItemDescription } from './resources/inventoryItem';
import { stockLocationDescription } from './resources/stockLocation';
import { orderDescription } from './resources/order';
import { fulfillmentDescription } from './resources/fulfillment';
import { regionDescription } from './resources/region';
import { salesChannelDescription } from './resources/salesChannel';
import { priceListDescription } from './resources/priceList';
import { promotionDescription } from './resources/promotion';
import { routeOperations } from './shared/router';

export class Medusa implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Medusa',
		name: 'medusa',
		icon: { light: 'file:../../icons/medusa.svg', dark: 'file:../../icons/medusa.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Automate commerce operations against the Medusa Admin API',
		defaults: {
			name: 'Medusa',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'medusaApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'product',
				options: [
					{ name: 'Customer', value: 'customer' },
					{ name: 'Customer Group', value: 'customerGroup' },
					{ name: 'Fulfillment', value: 'fulfillment' },
					{ name: 'Inventory Item', value: 'inventoryItem' },
					{ name: 'Order', value: 'order' },
					{ name: 'Price List', value: 'priceList' },
					{ name: 'Product', value: 'product' },
					{ name: 'Product Category', value: 'productCategory' },
					{ name: 'Product Collection', value: 'productCollection' },
					{ name: 'Product Variant', value: 'productVariant' },
					{ name: 'Promotion', value: 'promotion' },
					{ name: 'Region', value: 'region' },
					{ name: 'Sales Channel', value: 'salesChannel' },
					{ name: 'Stock Location', value: 'stockLocation' },
				],
			},
			...productDescription,
			...variantDescription,
			...categoryDescription,
			...collectionDescription,
			...customerDescription,
			...customerGroupDescription,
			...inventoryItemDescription,
			...stockLocationDescription,
			...orderDescription,
			...fulfillmentDescription,
			...regionDescription,
			...salesChannelDescription,
			...priceListDescription,
			...promotionDescription,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return routeOperations.call(this);
	}
}
