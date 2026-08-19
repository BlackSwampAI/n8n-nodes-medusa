import { describe, expect, it } from 'vitest';
import { Medusa } from '../../nodes/Medusa/Medusa.node';
import { bugReportForm, codex, manifest, readme } from '../support/manifest.mjs';

const description = new Medusa().description;
const resources = (
	description.properties.find((property) => property.name === 'resource')?.options ?? []
).map((option) => option as { name: string; value: string });

// The README fell out of step with the node once already: four resources shipped without their
// sections because a docs edit silently failed to apply. Nothing catches that except a reader, and
// a reader is exactly what is missing at release time.
describe('README keeps up with the node', () => {
	for (const resource of resources) {
		it(`documents ${resource.name}`, () => {
			expect(readme).toContain(`### ${resource.name}`);
		});
	}

	it('has the sections the release audit requires', () => {
		for (const heading of [
			'## Installation',
			'## Operations',
			'## Credentials',
			'## Compatibility',
			'## License',
		]) {
			expect(readme, `missing ${heading}`).toContain(heading);
		}
	});

	it('installs under the package name that is actually published', () => {
		expect(readme).toContain(manifest.name);
	});

	// The absence of a trigger is the single most likely surprise for someone installing this.
	it('explains why there is no trigger', () => {
		expect(readme).toMatch(/no trigger/i);
		expect(readme).toMatch(/webhook/i);
	});
});

// A report that cannot name the right resource is harder to act on, and the dropdown is exactly
// the sort of list that is forgotten when a resource is added.
describe('the bug report form keeps up with the node', () => {
	for (const resource of resources) {
		it(`offers ${resource.name}`, () => {
			expect(bugReportForm).toContain(`- ${resource.name}`);
		});
	}

	it('lets someone report a credential problem, which belongs to no resource', () => {
		expect(bugReportForm).toContain('Credential / connection');
	});

	it('asks people not to paste their API token', () => {
		expect(bugReportForm).toMatch(/do not paste your API token/i);
	});
});

describe('codex metadata', () => {
	it('identifies the node by its published package name', () => {
		expect(codex.node).toBe(`${manifest.name}.${description.name}`);
	});

	// n8n's directory only understands its own category list.
	it('uses categories n8n recognises', () => {
		const supported = [
			'AI',
			'Analytics',
			'Communication',
			'Core Nodes',
			'Data & Storage',
			'Development',
			'Finance & Accounting',
			'Marketing',
			'Miscellaneous',
			'Productivity',
			'Sales',
			'Utility',
		];
		expect(codex.categories.length).toBeGreaterThan(0);
		for (const category of codex.categories) {
			expect(supported, `unsupported category "${category}"`).toContain(category);
		}
	});

	it('points documentation at the real repository', () => {
		const urls = [
			...codex.resources.primaryDocumentation,
			...codex.resources.credentialDocumentation,
		].map((entry: { url: string }) => entry.url);

		for (const url of urls) {
			expect(url).toContain('github.com/BlackSwampAI/n8n-nodes-medusa');
		}
	});
});
