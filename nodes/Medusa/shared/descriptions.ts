import type { INodeProperties } from 'n8n-workflow';
import { MAX_PAGE_SIZE } from './transport';

/**
 * The Return All / Limit pair every list operation exposes.
 *
 * Medusa pages identically across every list route, so these fields are defined once and bound to
 * a resource rather than restated per operation.
 */
export function paginationFields(resource: string, operation = 'getAll'): INodeProperties[] {
	const showFor = { resource: [resource], operation: [operation] };

	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: { show: showFor },
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			default: 50,
			typeOptions: { minValue: 1 },
			description: 'Max number of results to return',
			displayOptions: { show: { ...showFor, returnAll: [false] } },
		},
	];
}

/**
 * Options every list operation accepts, beyond its own filters.
 *
 * `fields` is Medusa's sparse-fieldset and relation-expansion parameter, and `order` sorts by any
 * field with a `-` prefix for descending. Both apply uniformly across list routes.
 */
export function listOptionsFields(resource: string, operation = 'getAll'): INodeProperties {
	return {
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: [resource], operation: [operation] } },
		options: [
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'string',
				default: '',
				placeholder: 'title,handle,*variants',
				description:
					'Comma-separated list of fields to return. Prefix a relation with * to expand it, for example *variants.',
			},
			{
				displayName: 'Sort By',
				name: 'order',
				type: 'string',
				default: '',
				placeholder: 'created_at',
				description:
					'Field to sort by. Prefix with - for descending order, for example -created_at.',
			},
			{
				displayName: 'Page Size',
				name: 'pageSize',
				type: 'number',
				default: MAX_PAGE_SIZE,
				typeOptions: { minValue: 1, maxValue: MAX_PAGE_SIZE },
				description:
					'Records to request per API call while paging. Lower this if Medusa times out on large pages.',
			},
		],
	};
}
