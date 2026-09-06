import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function prepareNpmAuth(environment = process.env) {
	if (environment.NODE_AUTH_TOKEN) return 'token';
	const config = environment.NPM_CONFIG_USERCONFIG;
	if (!config || !existsSync(config)) return 'oidc';
	const lines = readFileSync(config, 'utf8').split(/(?<=\n)/);
	const filtered = lines.filter(
		(line) =>
			!/^\s*\/\/registry\.npmjs\.org\/:_authToken=\$\{NODE_AUTH_TOKEN\}\s*(?:\r?\n)?$/.test(line),
	);
	if (lines.length !== filtered.length) writeFileSync(config, filtered.join(''));
	return 'oidc';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
	console.log(`npm authentication prepared for ${prepareNpmAuth()}`);
