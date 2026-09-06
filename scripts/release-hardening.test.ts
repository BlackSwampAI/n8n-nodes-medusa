/* eslint-disable @n8n/community-nodes/no-restricted-imports -- release tooling test */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareNpmAuth } from './prepare-npm-auth.mjs';
import { githubTagFailure, supportsNpmTrustedPublishing } from './release-check-lib.mjs';
import { isDeterministicSecurityFailure, isLikelyPropagationFailure } from './scan-policy.mjs';

describe('release hardening', () => {
	it('enforces npm and exact tag versions', () => {
		expect(supportsNpmTrustedPublishing('11.5.1')).toBe(true);
		expect(supportsNpmTrustedPublishing('11.5.0')).toBe(false);
		expect(
			githubTagFailure('0.1.1', {
				GITHUB_REF: 'refs/tags/v0.1.2',
				GITHUB_REF_TYPE: 'tag',
				GITHUB_REF_NAME: 'v0.1.2',
			}),
		).toContain('v0.1.1');
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
		const spec = '@blackswampai/n8n-nodes-medusa@0.1.1';
		expect(
			isLikelyPropagationFailure(`Reason: No package metadata found for version 0.1.1`, spec),
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
