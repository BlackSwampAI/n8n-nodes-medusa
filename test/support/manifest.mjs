// Filesystem and package.json access lives here, in JavaScript, for the same reason as env.mjs:
// the n8n community-node lint rules ban node: builtin imports in every .ts file, and strict mode
// forbids scoping those rules. See CONTRIBUTING.md.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

/**
 * Node entry points registered in package.json, as built dist paths.
 * @type {string[]}
 */
export const registeredNodes = packageJson.n8n?.nodes ?? [];

/**
 * Credential entry points registered in package.json, as built dist paths.
 * @type {string[]}
 */
export const registeredCredentials = packageJson.n8n?.credentials ?? [];

/**
 * dist/nodes/Medusa/Medusa.node.js -> nodes/Medusa/Medusa.node.ts
 * @param {string} distPath
 * @returns {string}
 */
export function toSourcePath(distPath) {
	return distPath.replace(/^dist\//, '').replace(/\.js$/, '.ts');
}

/**
 * True when the TypeScript source behind a registered dist path exists.
 * @param {string} distPath
 * @returns {boolean}
 */
export function sourceExists(distPath) {
	return existsSync(resolve(root, toSourcePath(distPath)));
}

/**
 * The published README, for checking that documentation keeps up with the node.
 * @type {string}
 */
export const readme = readFileSync(resolve(root, 'README.md'), 'utf8');

/** The node's codex metadata, which n8n reads for categories and documentation links. */
export const codex = JSON.parse(
	readFileSync(resolve(root, 'nodes/Medusa/Medusa.node.json'), 'utf8'),
);

/** package.json, for release checks. */
export const manifest = packageJson;

/** The bug report issue form, so its resource dropdown can be checked against the node. */
export const bugReportForm = readFileSync(
	resolve(root, '.github/ISSUE_TEMPLATE/bug_report.yml'),
	'utf8',
);
