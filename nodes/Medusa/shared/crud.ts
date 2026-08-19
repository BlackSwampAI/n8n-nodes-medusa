import type { IDataObject, IExecuteFunctions, JsonObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { medusaApiRequest, medusaApiRequestAllItems } from './transport';
import type { OperationHandler } from './types';

/**
 * Describes a Medusa resource that follows the plain CRUD shape.
 *
 * Several resources are structurally identical — a collection route, an item route, and an
 * envelope keyed by the resource name — and differ only in those names and in which fields they
 * accept. The handlers are shared from here; the field definitions stay with each resource,
 * because that is where the two genuinely differ and where the UX decisions live.
 */
export interface CrudConfig {
	/** Collection route, for example /admin/product-categories. */
	path: string;
	/** Key wrapping a single record in a response, for example product_category. */
	responseKey: string;
	/** Key wrapping the array in a list response, for example product_categories. */
	collectionKey: string;
	/** Human-readable name used in error messages, for example "product category". */
	resourceLabel: string;
	/** Node parameter holding the record ID, for example categoryId. */
	idParameter: string;
}

/** Parses a metadata field that may arrive as a JSON string. */
export function parseMetadata(
	context: IExecuteFunctions,
	body: IDataObject,
	index: number,
): IDataObject {
	if (typeof body.metadata !== 'string') return body;

	try {
		return { ...body, metadata: JSON.parse(body.metadata) };
	} catch {
		throw new NodeOperationError(context.getNode(), 'Metadata is not valid JSON', {
			itemIndex: index,
		});
	}
}

export function makeCreate(
	config: CrudConfig,
	buildBody: (context: IExecuteFunctions, index: number) => IDataObject,
): OperationHandler {
	return async function create(this: IExecuteFunctions, index: number): Promise<JsonObject> {
		const body = parseMetadata(this, buildBody(this, index), index);
		const response = await medusaApiRequest.call(this, 'POST', config.path, {
			body,
			resource: config.resourceLabel,
		});
		return response[config.responseKey] as JsonObject;
	};
}

export function makeGet(config: CrudConfig): OperationHandler {
	return async function get(this: IExecuteFunctions, index: number): Promise<JsonObject> {
		const id = this.getNodeParameter(config.idParameter, index) as string;
		const options = this.getNodeParameter('options', index, {}) as IDataObject;

		const response = await medusaApiRequest.call(this, 'GET', `${config.path}/${id}`, {
			query: { fields: options.fields as string },
			resource: config.resourceLabel,
			resourceId: id,
		});

		const record = response[config.responseKey] as JsonObject | undefined;

		// Medusa is not consistent about missing records. Products and categories answer 404, while
		// collections and product variants answer 200 with an empty body. Treating an empty envelope
		// as not-found here means every resource behaves the same way from a workflow's point of
		// view, instead of some of them emitting an empty item that looks like a successful read.
		if (!record) {
			throw new NodeOperationError(this.getNode(), `${config.resourceLabel} ${id} was not found`, {
				description:
					'It may have been deleted, or the ID may belong to a different Medusa installation.',
				itemIndex: index,
			});
		}

		return record;
	};
}

export function makeGetAll(
	config: CrudConfig,
	buildQuery: (filters: IDataObject, options: IDataObject) => IDataObject,
): OperationHandler {
	return async function getAll(this: IExecuteFunctions, index: number): Promise<JsonObject[]> {
		const returnAll = this.getNodeParameter('returnAll', index, false) as boolean;
		const limit = returnAll ? 0 : (this.getNodeParameter('limit', index, 50) as number);
		const filters = this.getNodeParameter('filters', index, {}) as IDataObject;
		const options = this.getNodeParameter('options', index, {}) as IDataObject;

		return medusaApiRequestAllItems.call(this, config.path, config.collectionKey, {
			returnAll,
			limit,
			pageSize: options.pageSize as number | undefined,
			query: buildQuery(filters, options),
			resource: config.resourceLabel,
		}) as Promise<JsonObject[]>;
	};
}

export function makeUpdate(
	config: CrudConfig,
	buildBody: (context: IExecuteFunctions, index: number) => IDataObject,
): OperationHandler {
	return async function update(this: IExecuteFunctions, index: number): Promise<JsonObject> {
		const id = this.getNodeParameter(config.idParameter, index) as string;
		const body = parseMetadata(this, buildBody(this, index), index);

		if (Object.keys(body).length === 0) {
			throw new NodeOperationError(this.getNode(), 'No fields to update were provided', {
				description: 'Add at least one field under Update Fields.',
				itemIndex: index,
			});
		}

		// Medusa updates with POST. It has no PUT or PATCH anywhere in its Admin API.
		const response = await medusaApiRequest.call(this, 'POST', `${config.path}/${id}`, {
			body,
			resource: config.resourceLabel,
			resourceId: id,
		});
		return response[config.responseKey] as JsonObject;
	};
}

export function makeDelete(config: CrudConfig): OperationHandler {
	return async function remove(this: IExecuteFunctions, index: number): Promise<JsonObject> {
		const id = this.getNodeParameter(config.idParameter, index) as string;

		// Medusa answers { id, object, deleted: true }, passed through so a workflow can branch on it.
		return medusaApiRequest.call(this, 'DELETE', `${config.path}/${id}`, {
			resource: config.resourceLabel,
			resourceId: id,
		});
	};
}

/**
 * Adds and removes members in a single call, which is what Medusa's assignment routes accept.
 *
 * These are first-class operations rather than a corner of Update, because attaching products to a
 * category or collection is exactly what a catalog sync does most often.
 */
export function makeAssign(
	config: CrudConfig,
	memberPath: string,
	parameters: { add: string; remove: string },
): OperationHandler {
	return async function assign(this: IExecuteFunctions, index: number): Promise<JsonObject> {
		const id = this.getNodeParameter(config.idParameter, index) as string;
		const addRaw = this.getNodeParameter(parameters.add, index, '') as string;
		const removeRaw = this.getNodeParameter(parameters.remove, index, '') as string;

		const toList = (value: string) =>
			value
				.split(',')
				.map((entry) => entry.trim())
				.filter(Boolean);

		const add = toList(addRaw);
		const remove = toList(removeRaw);

		if (add.length === 0 && remove.length === 0) {
			throw new NodeOperationError(this.getNode(), 'Nothing to add or remove', {
				description: 'Provide at least one ID to add or to remove.',
				itemIndex: index,
			});
		}

		const body: IDataObject = {};
		if (add.length) body.add = add;
		if (remove.length) body.remove = remove;

		const response = await medusaApiRequest.call(
			this,
			'POST',
			`${config.path}/${id}/${memberPath}`,
			{ body, resource: config.resourceLabel, resourceId: id },
		);
		return response[config.responseKey] as JsonObject;
	};
}
