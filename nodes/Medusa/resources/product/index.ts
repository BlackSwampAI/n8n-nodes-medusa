import type { INodeProperties } from 'n8n-workflow';
import { createProduct, productCreateDescription } from './create';
import { getProduct, productGetDescription } from './get';
import { getAllProducts, productGetAllDescription } from './getAll';
import { productUpdateDescription, updateProduct } from './update';
import { deleteProduct, productDeleteDescription } from './remove';
import type { OperationHandlers } from '../../shared/types';

export const productOperationSelector: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	default: 'getAll',
	displayOptions: { show: { resource: ['product'] } },
	options: [
		{
			name: 'Create',
			value: 'create',
			action: 'Create a product',
			description: 'Create a product',
		},
		{
			name: 'Delete',
			value: 'delete',
			action: 'Delete a product',
			description: 'Delete a product',
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get a product',
			description: 'Retrieve a single product',
		},
		{
			name: 'Get Many',
			value: 'getAll',
			action: 'Get many products',
			description: 'Retrieve many products',
		},
		{
			name: 'Update',
			value: 'update',
			action: 'Update a product',
			description: 'Update a product',
		},
	],
};

export const productDescription: INodeProperties[] = [
	productOperationSelector,
	...productCreateDescription,
	...productGetDescription,
	...productGetAllDescription,
	...productUpdateDescription,
	...productDeleteDescription,
];

export const productOperations: OperationHandlers = {
	create: createProduct,
	delete: deleteProduct,
	get: getProduct,
	getAll: getAllProducts,
	update: updateProduct,
};
