import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
const root = process.argv[2] ? resolve(process.argv[2]) : resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const require = createRequire(import.meta.url);
function assertIcons(registration, icon, owner) {
	const icons = typeof icon === 'string' ? [icon] : [icon?.light, icon?.dark];
	const declaredIcons = icons.filter(Boolean);
	if (declaredIcons.length === 0) throw new Error(`Packaged icon is required for ${owner}`);
	for (const value of declaredIcons) {
		if (!value.startsWith('file:'))
			throw new Error(`Packaged icon must use a file: SVG or PNG reference: ${value}`);
		const path = resolve(root, registration, '..', value.slice(5));
		const pathFromRoot = relative(root, path);
		if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot))
			throw new Error(`Packaged icon escapes the package root for ${owner}: ${value}`);
		if (!existsSync(path) || statSync(path).size === 0)
			throw new Error(`Missing or empty packaged icon for ${owner}: ${value}`);
		if (!/\.(?:svg|png)$/i.test(path)) throw new Error(`Icon must be SVG or PNG: ${value}`);
		if (/\.svg$/i.test(path)) {
			const match = /<svg\b[^>]*\bviewBox=["']([^"']+)["']/i.exec(readFileSync(path, 'utf8'));
			const values =
				match?.[1]
					.trim()
					.split(/[\s,]+/)
					.map(Number) ?? [];
			if (values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0)
				throw new Error(`Packaged SVG icon needs a usable viewBox: ${value}`);
		}
	}
}
const credentialNames = new Set();
for (const path of manifest.n8n.credentials) {
	const module = require(resolve(root, path));
	const Constructor = Object.values(module).find((value) => typeof value === 'function');
	const credential = new Constructor();
	credentialNames.add(credential.name);
	assertIcons(path, credential.icon, credential.name);
}
const referenced = new Set();
for (const path of manifest.n8n.nodes) {
	if (!existsSync(resolve(root, path))) throw new Error(`Missing registered node ${path}`);
	const module = require(resolve(root, path));
	const Constructor = Object.values(module).find((value) => typeof value === 'function');
	const node = new Constructor();
	assertIcons(path, node.description.icon, node.description.name);
	for (const credential of node.description.credentials ?? []) referenced.add(credential.name);
}
for (const name of credentialNames)
	if (!referenced.has(name)) throw new Error(`Orphaned credential ${name}`);
console.log('Compiled Medusa node and credential registration loaded successfully');
