import {
	NodeApiError,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestMethods,
	type IHttpRequestOptions,
	type ILoadOptionsFunctions,
	type JsonObject,
} from 'n8n-workflow';
import { describeMedusaError } from './errors';

export const MEDUSA_CREDENTIAL = 'medusaApi';

/** Medusa caps list endpoints well above this, but large pages are slow and memory-hungry. */
export const MAX_PAGE_SIZE = 100;

export type MedusaContext = IExecuteFunctions | ILoadOptionsFunctions;

/**
 * Trims a credential's base URL into something safe to concatenate paths onto.
 *
 * Throws rather than guessing on input that cannot work, because a silently wrong base URL
 * produces 404s that look like missing data rather than a misconfigured credential.
 */
export function normalizeBaseUrl(rawBaseUrl: string): string {
	const baseUrl = (rawBaseUrl ?? '').trim();

	if (!baseUrl) {
		throw new Error('No Base URL is set on the Medusa credential.');
	}

	if (!/^https?:\/\//i.test(baseUrl)) {
		throw new Error(
			`The Medusa Base URL must start with http:// or https:// (received "${baseUrl}").`,
		);
	}

	const trimmed = baseUrl.replace(/\/+$/, '');

	// Every path this node builds already starts with /admin. Accepting a base URL that ends in
	// /admin would produce /admin/admin/products, which 404s in a way that looks like the resource
	// is missing rather than like the credential is wrong.
	if (/\/admin$/i.test(trimmed)) {
		throw new Error(
			`Remove the trailing "/admin" from the Medusa Base URL — use "${trimmed.replace(/\/admin$/i, '')}" instead.`,
		);
	}

	return trimmed;
}

/** Drops undefined, null and empty-string query values so they never reach the URL. */
export function cleanQuery(query: IDataObject = {}): IDataObject {
	const cleaned: IDataObject = {};
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null || value === '') continue;
		cleaned[key] = value;
	}
	return cleaned;
}

export interface MedusaRequestOptions {
	query?: IDataObject;
	body?: IDataObject;
}

/** One page of a Medusa list endpoint. */
export interface MedusaPage<T> {
	items: T[];
	count: number;
}

export interface CollectOptions {
	/** Fetch every matching record, ignoring `limit`. */
	returnAll: boolean;
	/** Maximum records to return when `returnAll` is false. */
	limit: number;
	/** Records per request. Capped at MAX_PAGE_SIZE. */
	pageSize?: number;
}

/**
 * Walks a Medusa list endpoint to completion.
 *
 * Medusa pages with `limit` and `offset` and reports the matching total as `count`, so paging is
 * identical across every list route and this loop is written once. `fetchPage` is injected, which
 * keeps the loop free of any n8n or HTTP dependency and therefore directly testable.
 */
export async function collectAll<T>(
	fetchPage: (params: { limit: number; offset: number }) => Promise<MedusaPage<T>>,
	options: CollectOptions,
): Promise<T[]> {
	const { returnAll, limit } = options;

	if (!returnAll && limit <= 0) return [];

	const pageSize = Math.min(
		options.pageSize ?? MAX_PAGE_SIZE,
		MAX_PAGE_SIZE,
		returnAll ? MAX_PAGE_SIZE : limit,
	);

	const collected: T[] = [];
	let offset = 0;

	for (;;) {
		const page = await fetchPage({ limit: pageSize, offset });
		collected.push(...page.items);

		// An empty page means there is nothing further to read. Without this guard a server that
		// reports a count it cannot deliver would spin forever.
		if (page.items.length === 0) break;

		if (!returnAll && collected.length >= limit) break;

		offset += page.items.length;
		if (offset >= page.count) break;
	}

	return returnAll ? collected : collected.slice(0, limit);
}

/**
 * Reads the array out of a Medusa list response.
 *
 * Responses are shaped `{ products: [...], count, limit, offset }`, with the collection under a
 * key named after the resource.
 */
export function extractPage<T>(response: unknown, collectionKey: string): MedusaPage<T> {
	const body = (response ?? {}) as JsonObject;
	const items = body[collectionKey];

	if (!Array.isArray(items)) {
		throw new Error(
			`Medusa returned no "${collectionKey}" collection. The response did not have the expected shape.`,
		);
	}

	return {
		items: items as T[],
		count: typeof body.count === 'number' ? body.count : items.length,
	};
}

/** Builds the request n8n will send, with authentication supplied by the credential. */
export function buildRequestOptions(
	baseUrl: string,
	method: IHttpRequestMethods,
	path: string,
	options: MedusaRequestOptions = {},
): IHttpRequestOptions {
	const request: IHttpRequestOptions = {
		method,
		url: `${normalizeBaseUrl(baseUrl)}${path}`,
		qs: cleanQuery(options.query),
		json: true,
	};

	if (options.body !== undefined) request.body = options.body;

	return request;
}

/** Issues a single authenticated request against the Medusa Admin API. */
export async function medusaApiRequest(
	this: MedusaContext,
	method: IHttpRequestMethods,
	path: string,
	options: MedusaRequestOptions & { resource?: string; resourceId?: string } = {},
): Promise<JsonObject> {
	const credentials = await this.getCredentials(MEDUSA_CREDENTIAL);
	const baseUrl = String(credentials.baseUrl ?? '');

	let request: IHttpRequestOptions;
	try {
		request = buildRequestOptions(baseUrl, method, path, options);
	} catch (error) {
		// A malformed base URL is the user's configuration, not a failed API call.
		throw new NodeOperationError(this.getNode(), (error as Error).message);
	}

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			MEDUSA_CREDENTIAL,
			request,
		)) as JsonObject;
	} catch (error) {
		const described = describeMedusaError(error, {
			resource: options.resource,
			resourceId: options.resourceId,
			baseUrl: normalizeBaseUrl(baseUrl),
		});
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			message: described.message,
			description: described.description,
		});
	}
}

/** Issues requests against a Medusa list endpoint until the requested records are collected. */
export async function medusaApiRequestAllItems<T = JsonObject>(
	this: MedusaContext,
	path: string,
	collectionKey: string,
	options: CollectOptions & { query?: IDataObject; resource?: string },
): Promise<T[]> {
	return collectAll<T>(async ({ limit, offset }) => {
		const response = await medusaApiRequest.call(this, 'GET', path, {
			query: { ...options.query, limit, offset },
			resource: options.resource,
		});
		return extractPage<T>(response, collectionKey);
	}, options);
}
