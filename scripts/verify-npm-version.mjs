import { execFileSync } from 'node:child_process';
import { supportsNpmTrustedPublishing } from './release-check-lib.mjs';
const version = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
if (!supportsNpmTrustedPublishing(version)) throw new Error('npm 11.5.1 or newer is required');
console.log(`npm ${version} satisfies Trusted Publishing requirements`);
