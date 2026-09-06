export function assertDisposableMedusaTarget(baseUrl, apiToken, marker) {
	let url;
	try {
		url = new URL(String(baseUrl ?? ''));
	} catch {
		throw new Error('Medusa integration tests require a valid loopback MEDUSA_BASE_URL.');
	}
	if (!['http:', 'https:'].includes(url.protocol))
		throw new Error('Medusa integration tests require an HTTP(S) MEDUSA_BASE_URL.');
	if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || marker !== 'true')
		throw new Error(
			'Medusa integration tests require a loopback URL and MEDUSA_DISPOSABLE_TEST_ENV=true.',
		);
	if (typeof apiToken !== 'string' || apiToken.trim() === '')
		throw new Error('Medusa integration tests require a nonblank MEDUSA_API_TOKEN.');
	return url.toString().replace(/\/$/, '');
}

export function validateDisposableMedusaConfiguration(baseUrl, apiToken, marker) {
	if (!baseUrl && !apiToken) return false;
	assertDisposableMedusaTarget(baseUrl, apiToken, marker);
	return true;
}
