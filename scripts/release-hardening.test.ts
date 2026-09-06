/* eslint-disable @n8n/community-nodes/no-restricted-imports -- release tooling test */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareNpmAuth } from './prepare-npm-auth.mjs';
import { githubTagFailure, supportsNpmTrustedPublishing } from './release-check-lib.mjs';
import { isDeterministicSecurityFailure, isLikelyPropagationFailure } from './scan-policy.mjs';
import packageJson from '../package.json';

describe('release hardening', () => {
	it('enforces npm and exact versions only for true tag refs', () => {
		expect(supportsNpmTrustedPublishing('11.5.1')).toBe(true);
		expect(supportsNpmTrustedPublishing('11.5.0')).toBe(false);
		expect(githubTagFailure(packageJson.version, {})).toBeUndefined();
		expect(
			githubTagFailure(packageJson.version, {
				GITHUB_REF: 'refs/pull/16/merge',
				GITHUB_REF_TYPE: 'branch',
				GITHUB_REF_NAME: '16/merge',
			}),
		).toBeUndefined();
		const expected = `v${packageJson.version}`;
		expect(
			githubTagFailure(packageJson.version, {
				GITHUB_REF: `refs/tags/${expected}`,
				GITHUB_REF_TYPE: 'tag',
				GITHUB_REF_NAME: expected,
			}),
		).toBeUndefined();
		expect(
			githubTagFailure(packageJson.version, {
				GITHUB_REF: 'refs/tags/v9.9.9',
				GITHUB_REF_TYPE: 'tag',
				GITHUB_REF_NAME: 'v9.9.9',
			}),
		).toContain(expected);
	});

	it('removes only setup-node empty auth for OIDC', () => {
		const directory = mkdtempSync(join(tmpdir(), 'medusa-auth-'));
		try {
			const config = join(directory, '.npmrc');
			writeFileSync(
				config,
				'registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}\n',
			);
			expect(prepareNpmAuth({ NPM_CONFIG_USERCONFIG: config })).toBe('oidc');
			expect(readFileSync(config, 'utf8')).toBe('registry=https://registry.npmjs.org/\n');
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it('retries only exact propagation failures', () => {
		const spec = `${packageJson.name}@${packageJson.version}`;
		expect(
			isLikelyPropagationFailure(
				`Reason: No package metadata found for version ${packageJson.version}`,
				spec,
			),
		).toBe(true);
		expect(
			isLikelyPropagationFailure(`Reason: No package metadata found for version 0.1.0`, spec),
		).toBe(false);
		expect(
			isDeterministicSecurityFailure(
				`Package ${spec} has failed security checks\nReason: ESLint violations found\n404:3 error`,
				spec,
			),
		).toBe(true);
	});
});
