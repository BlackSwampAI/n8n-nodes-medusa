import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class MedusaApi implements ICredentialType {
	name = 'medusaApi';

	displayName = 'Medusa API';

	icon: Icon = { light: 'file:../icons/medusa.svg', dark: 'file:../icons/medusa.dark.svg' };

	documentationUrl = 'https://docs.medusajs.com/api/admin#authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://commerce.example.com',
			description:
				'Root URL of your Medusa server, without the /admin path. Use http://localhost:9000 for a local install.',
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'A secret API key created in the Medusa admin under Settings > Secret API Keys. Publishable keys will not work.',
		},
	];

	// Medusa's Admin API declares its token scheme as HTTP Basic, not Bearer, and accepts the
	// secret key unencoded. n8n's built-in Basic Auth type cannot be used because it base64
	// encodes a user:password pair, which is not the shape Medusa expects.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Basic {{ $credentials.apiToken }}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ $credentials.baseUrl.replace(/\\/+$/, "") }}',
			url: '/admin/users/me',
			method: 'GET',
		},
	};
}
