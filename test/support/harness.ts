import type { IExecuteFunctions, IHttpRequestOptions, INode } from 'n8n-workflow';
import { medusaApiToken, medusaBaseUrl } from './env.mjs';

/**
 * Failure shape matching what n8n's HTTP helper surfaces, so `describeMedusaError` sees in tests
 * exactly what it will see in production.
 */
class HarnessHttpError extends Error {
	constructor(
		readonly statusCode: number,
		readonly response: { body: unknown },
	) {
		super(`Request failed with status ${statusCode}`);
	}
}

export interface HarnessOptions {
	/** Node parameters, keyed exactly as the operation reads them. */
	parameters: Record<string, unknown>;
	/** Input items. Defaults to a single empty item. */
	items?: Array<{ json: Record<string, unknown> }>;
	continueOnFail?: boolean;
	/** Overrides the credential, for testing bad configuration. */
	credentials?: { baseUrl?: string; apiToken?: string };
}

/**
 * A minimal stand-in for n8n's execution context.
 *
 * Integration tests drive the real operation handlers and the real router through this, so what is
 * verified is the code that ships rather than a reimplementation of it. Authentication mirrors the
 * credential: HTTP Basic carrying the unencoded secret key.
 */
export function createExecuteFunctions(options: HarnessOptions): IExecuteFunctions {
	const items = options.items ?? [{ json: {} }];

	const context = {
		getInputData: () => items,
		getNode: () =>
			({
				id: 'test-node',
				name: 'Medusa',
				type: 'medusa',
				typeVersion: 1,
				position: [0, 0],
			}) as unknown as INode,
		continueOnFail: () => options.continueOnFail ?? false,
		getNodeParameter: (name: string, _index: number, fallback?: unknown) =>
			name in options.parameters ? options.parameters[name] : fallback,
		getCredentials: async () => ({
			baseUrl: options.credentials?.baseUrl ?? medusaBaseUrl,
			apiToken: options.credentials?.apiToken ?? medusaApiToken,
		}),
		helpers: {
			async httpRequestWithAuthentication(_credentialType: string, request: IHttpRequestOptions) {
				const url = new URL(String(request.url));
				for (const [key, value] of Object.entries(request.qs ?? {})) {
					if (Array.isArray(value)) {
						// Serialised as key[]=a&key[]=b, matching how axios — and therefore n8n's HTTP
						// helper — encodes arrays. Medusa rejects the bare key=a form with
						// "Expected type: 'array'", so getting this wrong here would make the harness
						// disagree with production and hide or invent failures.
						for (const entry of value) url.searchParams.append(`${key}[]`, String(entry));
					} else {
						url.searchParams.set(key, String(value));
					}
				}

				const token = options.credentials?.apiToken ?? medusaApiToken;
				const response = await fetch(url.toString(), {
					method: request.method ?? 'GET',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Basic ${token}`,
					},
					body: request.body === undefined ? undefined : JSON.stringify(request.body),
				});

				const text = await response.text();
				let body: unknown = text;
				try {
					body = JSON.parse(text);
				} catch {
					// Non-JSON bodies are passed through; the error mapper handles them.
				}

				if (!response.ok) throw new HarnessHttpError(response.status, { body });
				return body;
			},
		},
	};

	return context as unknown as IExecuteFunctions;
}
