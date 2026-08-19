// JavaScript rather than TypeScript deliberately: the n8n community-node lint rules apply to
// every .ts file in the repository and cannot be scoped, so a .ts config here would be linted as
// node source. See CONTRIBUTING.md.
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['test/**/*.test.ts'],
		// Integration tests talk to one shared Medusa server, so they must not run concurrently
		// with each other across files.
		fileParallelism: false,
		testTimeout: 30_000,
	},
});
