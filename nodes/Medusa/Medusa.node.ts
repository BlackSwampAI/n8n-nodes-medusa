import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';

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
		requestDefaults: {
			baseURL: '={{ $credentials.baseUrl.replace(/\\/+$/, "") }}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		// Resources and operations are added per milestone, starting with Product.
		properties: [],
	};
}
