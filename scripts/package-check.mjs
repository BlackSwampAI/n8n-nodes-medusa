import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const [pack] = JSON.parse(
	execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: root, encoding: 'utf8' }),
);
const files = new Set(pack.files.map(({ path }) => path));
for (const path of [
	'README.md',
	'LICENSE.md',
	'package.json',
	...manifest.n8n.nodes,
	...manifest.n8n.credentials,
])
	if (!files.has(path)) throw new Error(`Packed package is missing ${path}`);
for (const path of files)
	if (!['README.md', 'LICENSE.md', 'package.json'].includes(path) && !path.startsWith('dist/'))
		throw new Error(`Unexpected packed file ${path}`);
console.log(`Package boundary passed (${files.size} files)`);
