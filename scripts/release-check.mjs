import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { githubTagFailure } from './release-check-lib.mjs';
const root = resolve(import.meta.dirname, '..');
const failures = [];
const fail = (message) => failures.push(message);
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const ci = read('.github/workflows/ci.yml');
const publish = read('.github/workflows/publish.yml');
let marker;
try {
	marker = JSON.parse(read('.blackswamp/template.json'));
} catch {
	fail('.blackswamp/template.json must contain valid JSON');
}
if (
	JSON.stringify(marker) !==
	JSON.stringify({
		schemaVersion: 1,
		templateVersion: '2.0.0',
		sourceRepository: 'https://github.com/christopherjnelson/n8n-community-node-template',
	})
)
	fail('Template v2 marker is invalid');
if (pkg.name !== '@blackswampai/n8n-nodes-medusa') fail('package identity is invalid');
if (pkg.homepage !== 'https://blackswampai.com/n8n-nodes/medusa/')
	fail('package homepage is invalid');
if (pkg.bugs?.url !== 'https://github.com/BlackSwampAI/n8n-nodes-medusa/issues')
	fail('package bugs URL is invalid');
if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(pkg.version ?? ''))
	fail('version must be plain semver');
if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version)
	fail('lock version must match package version');
if (pkg.packageManager !== 'npm@11.19.0') fail('packageManager must pin npm@11.19.0');
if (Object.keys(pkg.dependencies ?? {}).length) fail('runtime dependencies are prohibited');
if (
	pkg.peerDependencies?.['n8n-workflow'] !== '*' ||
	pkg.n8n?.strict !== true ||
	pkg.license !== 'MIT' ||
	pkg.publishConfig?.access !== 'public'
)
	fail('package release metadata is invalid');
for (const path of [
	'docs/api-matrix.md',
	'docs/testing.md',
	'docs/branding.md',
	'docs/BATCH_HANDOFF_TEMPLATE.md',
	'docs/TEMPLATE_MIGRATIONS.md',
	'.github/pull_request_template.md',
	'.codex/config.toml',
	'.codex/agents/builder.toml',
	'scripts/prepare-npm-auth.mjs',
	'scripts/verify-npm-version.mjs',
	'scripts/scan-source.mjs',
	'scripts/scan-published.mjs',
	'scripts/package-check.mjs',
	'scripts/node-load-smoke.mjs',
	'scripts/package-install-smoke.mjs',
])
	if (!existsSync(resolve(root, path))) fail(`${path} is required`);
if (!/timeout-minutes:\s*20/.test(ci) || !/timeout-minutes:\s*30/.test(publish))
	fail('workflow timeouts are missing');
if (!/MEDUSA_DISPOSABLE_TEST_ENV:\s*['"]true['"]/.test(ci))
	fail('integration CI must explicitly mark the Medusa target disposable');
if (!/id-token:\s*write/.test(publish) || publish.includes('NPM_TOKEN'))
	fail('publish must use tokenless OIDC');
for (const workflow of [ci, publish])
	for (const command of [
		'npm install --global npm@11.19.0',
		'npm run build',
		'npm run scan:source',
		'npm run release:check',
		'npm run package:check',
		'npm run smoke:load',
		'npm run smoke:install',
	])
		if (!workflow.includes(command)) fail(`workflow missing ${command}`);
if (
	!publish.includes('node scripts/prepare-npm-auth.mjs') ||
	!publish.includes('npm run scan:published')
)
	fail('publish auth/scanner sequence is incomplete');
if (!read('scripts/scan-published.mjs').includes('has passed all security checks'))
	fail('published scanner must require exact official success text');
if (existsSync(resolve(root, '.github/ISSUE_TEMPLATE/release-0.1.0.md')))
	fail('stale 0.1.0-only release checklist must be removed');
const tagFailure = githubTagFailure(pkg.version);
for (const guidance of ['Creator Portal', 'contrasting backgrounds', 'published 0.1.1 tarball'])
	if (!read('docs/branding.md').includes(guidance))
		fail(`branding qualification is missing: ${guidance}`);
if (tagFailure) fail(tagFailure);
try {
	const origin = execFileSync('git', ['remote', 'get-url', 'origin'], {
		cwd: root,
		encoding: 'utf8',
	})
		.trim()
		.replace(/^git@github\.com:/, 'https://github.com/')
		.replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/')
		.replace(/\.git$/, '');
	if (origin !== 'https://github.com/BlackSwampAI/n8n-nodes-medusa')
		fail('git origin does not match package repository');
} catch {
	fail('unable to verify git origin');
}
if (failures.length) {
	console.error(`Release audit failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
	process.exit(1);
}
console.log(`Release audit passed for ${pkg.name}@${pkg.version}`);
