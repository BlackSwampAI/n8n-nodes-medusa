import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const temporary = mkdtempSync(join(tmpdir(), 'medusa-package-smoke-'));
try {
	const [{ filename }] = JSON.parse(
		execFileSync('npm', ['pack', '--json', '--pack-destination', temporary], {
			cwd: root,
			encoding: 'utf8',
		}),
	);
	const consumer = join(temporary, 'consumer');
	mkdirSync(consumer);
	writeFileSync(join(consumer, 'package.json'), '{"name":"medusa-smoke","private":true}\n');
	execFileSync(
		'npm',
		[
			'install',
			'--ignore-scripts',
			'--no-package-lock',
			'--omit=peer',
			'--no-audit',
			'--no-fund',
			join(temporary, filename),
		],
		{ cwd: consumer },
	);
	const installed = join(consumer, 'node_modules', '@blackswampai', 'n8n-nodes-medusa');
	execFileSync(process.execPath, [resolve(root, 'scripts/node-load-smoke.mjs'), installed], {
		env: { ...process.env, NODE_PATH: resolve(root, 'node_modules') },
		stdio: 'inherit',
	});
	console.log('Packed package installed and loaded in an isolated consumer');
} finally {
	rmSync(temporary, { recursive: true, force: true });
}
