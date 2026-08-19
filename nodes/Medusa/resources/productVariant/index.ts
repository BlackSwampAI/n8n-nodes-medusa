import type { INodeProperties } from 'n8n-workflow';
import type { OperationHandlers } from '../../shared/types';
import { createVariant, variantCreateDescription } from './create';
import { getVariant, variantGetDescription } from './get';
import { getAllVariants, variantGetAllDescription } from './getAll';
import { updateVariant, variantUpdateDescription } from './update';
import { deleteVariant, variantDeleteDescription } from './remove';

export const variantDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'getAll',
		displayOptions: { show: { resource: ['productVariant'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a product variant',
				description: 'Create a product variant',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a product variant',
				description: 'Delete a product variant',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a product variant',
				description: 'Retrieve a single product variant',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many product variants',
				description: 'Retrieve many product variants',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a product variant',
				description: 'Update a product variant',
			},
		],
	},
	...variantCreateDescription,
	...variantGetDescription,
	...variantGetAllDescription,
	...variantUpdateDescription,
	...variantDeleteDescription,
];

export const variantOperations: OperationHandlers = {
	create: createVariant,
	delete: deleteVariant,
	get: getVariant,
	getAll: getAllVariants,
	update: updateVariant,
};
