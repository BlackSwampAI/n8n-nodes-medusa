import {
	NodeConnectionTypes,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { productDescription } from './resources/product';
import { variantDescription } from './resources/productVariant';
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
					{ name: 'Product', value: 'product' },
					{ name: 'Product Variant', value: 'productVariant' },
				],
			},
			...productDescription,
			...variantDescription,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return routeOperations.call(this);
	}
}
