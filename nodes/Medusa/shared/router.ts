import {
	NodeApiError,
	NodeOperationError,
	type IExecuteFunctions,
	type INodeExecutionData,
} from 'n8n-workflow';
import { productOperations } from '../resources/product';
import { variantOperations } from '../resources/productVariant';
import type { OperationHandlers } from './types';

const resources: Record<string, OperationHandlers> = {
	product: productOperations,
	productVariant: variantOperations,
};

/**
 * Dispatches each input item to the handler for the selected resource and operation.
 *
 * Every item is processed independently so that Continue On Fail can report a failure per item
 * rather than losing a whole batch — which matters for catalog syncs, where one malformed row
 * should not discard the rest of the run.
 */
export async function routeOperations(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const resource = this.getNodeParameter('resource', 0) as string;
	const operation = this.getNodeParameter('operation', 0) as string;

	const handler = resources[resource]?.[operation];
	if (!handler) {
		throw new NodeOperationError(
			this.getNode(),
			`The operation "${operation}" is not supported for the resource "${resource}"`,
		);
	}

	const returnData: INodeExecutionData[] = [];

	for (let index = 0; index < items.length; index++) {
		try {
			const result = await handler.call(this, index);
			const records = Array.isArray(result) ? result : [result];
			returnData.push(...records.map((json) => ({ json, pairedItem: { item: index } })));
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({
					json: { error: (error as Error).message },
					pairedItem: { item: index },
				});
				continue;
			}

			// The transport already maps API failures into NodeApiError, and the handlers raise
			// NodeOperationError for bad input, so those are passed through rather than wrapped a
			// second time and losing their message.
			throw error instanceof NodeApiError || error instanceof NodeOperationError
				? error
				: new NodeOperationError(this.getNode(), error as Error, { itemIndex: index });
		}
	}

	return [returnData];
}
