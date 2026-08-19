import type { JsonObject } from 'n8n-workflow';

export interface MedusaErrorDescription {
	/** Short statement of what went wrong, shown as the error title. */
	message: string;
	/** How to fix it, shown underneath. */
	description: string;
}

interface ErrorLike {
	statusCode?: number;
	httpCode?: number | string;
	code?: string;
	message?: string;
	response?: { status?: number; body?: unknown; data?: unknown };
	body?: unknown;
	cause?: unknown;
}

function statusOf(error: ErrorLike): number | undefined {
	const raw = error.statusCode ?? error.response?.status ?? error.httpCode;
	const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw;
	return Number.isFinite(parsed) ? (parsed as number) : undefined;
}

function bodyOf(error: ErrorLike): unknown {
	return error.response?.body ?? error.response?.data ?? error.body;
}

/**
 * Medusa answers with `{ type, message }` on handled errors. Pull out the server's own wording,
 * which is almost always more useful than anything we could invent — particularly for validation
 * failures, which name the offending field.
 */
export function medusaServerMessage(body: unknown): string | undefined {
	if (typeof body === 'string') {
		const trimmed = body.trim();
		if (!trimmed || trimmed.startsWith('<')) return undefined;
		try {
			return medusaServerMessage(JSON.parse(trimmed));
		} catch {
			return trimmed.slice(0, 300);
		}
	}

	if (body && typeof body === 'object') {
		const candidate = body as JsonObject;
		if (typeof candidate.message === 'string') return candidate.message;
		if (Array.isArray(candidate.errors)) {
			const messages = candidate.errors
				.map((entry) =>
					entry && typeof entry === 'object'
						? (entry as JsonObject).message
						: typeof entry === 'string'
							? entry
							: undefined,
				)
				.filter((entry): entry is string => typeof entry === 'string');
			if (messages.length) return messages.join('; ');
		}
	}

	return undefined;
}

/** True when the response is HTML, which means the URL is not a Medusa Admin API. */
function looksLikeHtml(body: unknown): boolean {
	return typeof body === 'string' && /^\s*<(?:!doctype|html)/i.test(body);
}

/**
 * Turns whatever the HTTP layer threw into something a workflow author can act on.
 *
 * Medusa's own message is preserved wherever there is one. The four failures worth telling apart
 * are a rejected token, a missing resource, a validation failure, and simply not reaching the
 * server — each needs a different fix, and an opaque status code tells the user none of that.
 */
export function describeMedusaError(
	error: unknown,
	context: { resource?: string; resourceId?: string; baseUrl?: string } = {},
): MedusaErrorDescription {
	const err = (error ?? {}) as ErrorLike;
	const status = statusOf(err);
	const body = bodyOf(err);
	const serverMessage = medusaServerMessage(body);
	const subject = context.resource ?? 'resource';

	if (looksLikeHtml(body)) {
		return {
			message: 'The server responded with a web page instead of API data',
			description:
				'The base URL is reachable but does not appear to be a Medusa Admin API. It often points at a storefront rather than the Medusa server. Check the Base URL in your credential.',
		};
	}

	const networkCode = err.code ?? (err.cause as ErrorLike | undefined)?.code;
	if (status === undefined && networkCode) {
		const target = context.baseUrl ? ` at ${context.baseUrl}` : '';
		if (networkCode === 'ENOTFOUND' || networkCode === 'EAI_AGAIN') {
			return {
				message: `Could not resolve the Medusa server${target}`,
				description:
					'The host name in the Base URL does not resolve. Check the credential for a typo, and that the host is reachable from this n8n instance.',
			};
		}
		if (networkCode === 'ECONNREFUSED') {
			return {
				message: `Could not connect to the Medusa server${target}`,
				description:
					'The host resolved but refused the connection. Check that Medusa is running and that the port in the Base URL is correct.',
			};
		}
		if (networkCode === 'ETIMEDOUT' || networkCode === 'ECONNRESET') {
			return {
				message: `The connection to the Medusa server${target} timed out`,
				description:
					'The server did not respond in time. It may be overloaded, or a firewall may be dropping the connection.',
			};
		}
		if (networkCode.startsWith?.('CERT_') || networkCode.startsWith?.('UNABLE_TO_VERIFY')) {
			return {
				message: 'The Medusa server presented an invalid TLS certificate',
				description:
					'The certificate could not be verified. Use a valid certificate, or connect over http:// for a local development server.',
			};
		}
		return {
			message: `Could not reach the Medusa server${target}`,
			description: `The request failed before the server responded (${networkCode}).`,
		};
	}

	switch (status) {
		case 401:
		case 403:
			return {
				message: 'Medusa rejected the API token',
				description:
					'Check that the credential holds a secret API key created under Settings > Secret API Keys. A publishable key is scoped to storefronts and cannot access the Admin API.',
			};
		case 404:
			return {
				message: context.resourceId
					? `${subject} ${context.resourceId} was not found`
					: `The requested ${subject} was not found`,
				description:
					serverMessage ??
					'It may have been deleted, or the ID may belong to a different Medusa installation.',
			};
		case 400:
		case 422:
			return {
				message: serverMessage ?? `Medusa rejected the ${subject} data as invalid`,
				description: 'Check the field values sent with this operation.',
			};
		case 409:
			return {
				message: serverMessage ?? `The ${subject} conflicts with the current state`,
				description:
					'This usually means a duplicate value such as a handle, or an action that no longer applies — cancelling an order that is already cancelled, for example.',
			};
		case 429:
			return {
				message: 'Medusa is rate limiting this connection',
				description: 'Too many requests were sent. Retry after a short delay.',
			};
		default:
			break;
	}

	if (status !== undefined && status >= 500) {
		return {
			message: serverMessage ?? `The Medusa server failed with status ${status}`,
			description: 'This is an error inside Medusa rather than in the request. Check its logs.',
		};
	}

	return {
		message: serverMessage ?? err.message ?? 'The request to Medusa failed',
		description:
			status === undefined
				? 'No response was received.'
				: `Medusa responded with status ${status}.`,
	};
}
