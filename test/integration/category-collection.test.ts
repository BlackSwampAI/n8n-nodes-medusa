import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { routeOperations } from '../../nodes/Medusa/shared/router';
import { hasMedusa, medusaApiToken, medusaBaseUrl } from '../support/env.mjs';
import { createExecuteFunctions } from '../support/harness';

const describeMedusa = hasMedusa ? describe : describe.skip;
const baseUrl = String(medusaBaseUrl ?? '').replace(/\/+$/, '');
const prefix = `n8n-cc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cleanup: Array<{ path: string; id: string }> = [];

async function run(parameters: Record<string, unknown>, extra: Record<string, unknown> = {}) {
	const context = createExecuteFunctions({ parameters, ...extra });
	const [output] = await routeOperations.call(context);
	return output;
}

interface Record_ {
	id: string;
	name?: string;
	title?: string;
	handle?: string;
	is_active?: boolean;
	products?: Array<{ id: string }>;
}

async function createProduct(title: string) {
	const output = await run({
		resource: 'product',
		operation: 'create',
		title,
		variants: { variant: [{ title: 'Default', currencyCode: 'usd', amount: 5 }] },
		additionalFields: {},
	});
	const id = (output[0].json as unknown as Record_).id;
	cleanup.push({ path: 'products', id });
	return id;
}

describeMedusa('category and collection operations against a live Medusa server', () => {
	let productId: string;

	beforeAll(async () => {
		productId = await createProduct(`${prefix} product`);
	}, 120_000);

	afterAll(async () => {
		for (const entry of cleanup.reverse()) {
			await fetch(`${baseUrl}/admin/${entry.path}/${entry.id}`, {
				method: 'DELETE',
				headers: { Authorization: `Basic ${medusaApiToken}` },
			});
		}
	}, 120_000);

	// Both resources are structurally identical, so the same lifecycle runs against each. The
	// differences that matter are the required field and the response envelope, and a shared table
	// makes a divergence in either one obvious.
	const resources = [
		{
			label: 'product category',
			resource: 'productCategory',
			path: 'product-categories',
			idParameter: 'categoryId',
			requiredField: 'name',
			nameOf: (record: Record_) => record.name,
		},
		{
			label: 'product collection',
			resource: 'productCollection',
			path: 'collections',
			idParameter: 'collectionId',
			requiredField: 'title',
			nameOf: (record: Record_) => record.title,
		},
	];

	for (const subject of resources) {
		describe(subject.label, () => {
			let recordId: string;

			it('creates a record', async () => {
				const output = await run({
					resource: subject.resource,
					operation: 'create',
					[subject.requiredField]: `${prefix} ${subject.path}`,
					additionalFields: {},
				});

				const record = output[0].json as unknown as Record_;
				recordId = record.id;
				cleanup.push({ path: subject.path, id: recordId });

				expect(recordId).toBeTruthy();
				expect(subject.nameOf(record)).toBe(`${prefix} ${subject.path}`);
				// Handles are generated from the required field when none is supplied.
				expect(record.handle).toBeTruthy();
			});

			it('reads it back by ID', async () => {
				const output = await run({
					resource: subject.resource,
					operation: 'get',
					[subject.idParameter]: recordId,
					options: {},
				});
				expect((output[0].json as unknown as Record_).id).toBe(recordId);
			});

			it('lists records and respects a limit', async () => {
				const output = await run({
					resource: subject.resource,
					operation: 'getAll',
					returnAll: false,
					limit: 1,
					filters: { q: prefix },
					options: {},
				});
				expect(output).toHaveLength(1);
			});

			it('updates it', async () => {
				const output = await run({
					resource: subject.resource,
					operation: 'update',
					[subject.idParameter]: recordId,
					updateFields: { [subject.requiredField]: `${prefix} renamed` },
				});
				expect(subject.nameOf(output[0].json as unknown as Record_)).toBe(`${prefix} renamed`);
			});

			it('adds a product and then removes it again', async () => {
				const added = await run({
					resource: subject.resource,
					operation: 'addProducts',
					[subject.idParameter]: recordId,
					addProductIds: productId,
					removeProductIds: '',
				});
				expect((added[0].json as unknown as Record_).id).toBe(recordId);

				const withProducts = await run({
					resource: subject.resource,
					operation: 'get',
					[subject.idParameter]: recordId,
					options: { fields: 'id,*products' },
				});
				const products = (withProducts[0].json as unknown as Record_).products ?? [];
				expect(products.map((product) => product.id)).toContain(productId);

				await run({
					resource: subject.resource,
					operation: 'addProducts',
					[subject.idParameter]: recordId,
					addProductIds: '',
					removeProductIds: productId,
				});

				const afterRemoval = await run({
					resource: subject.resource,
					operation: 'get',
					[subject.idParameter]: recordId,
					options: { fields: 'id,*products' },
				});
				const remaining = (afterRemoval[0].json as unknown as Record_).products ?? [];
				expect(remaining.map((product) => product.id)).not.toContain(productId);
			});

			it('rejects an assignment that would do nothing', async () => {
				await expect(
					run({
						resource: subject.resource,
						operation: 'addProducts',
						[subject.idParameter]: recordId,
						addProductIds: '',
						removeProductIds: '',
					}),
				).rejects.toThrow(/nothing to add or remove/i);
			});

			it('rejects an update with no fields', async () => {
				await expect(
					run({
						resource: subject.resource,
						operation: 'update',
						[subject.idParameter]: recordId,
						updateFields: {},
					}),
				).rejects.toThrow(/no fields to update/i);
			});

			it('names the record that was not found', async () => {
				await expect(
					run({
						resource: subject.resource,
						operation: 'get',
						[subject.idParameter]: 'does_not_exist',
						options: {},
					}),
				).rejects.toThrow(new RegExp(`${subject.label} does_not_exist was not found`));
			});

			it('deletes it', async () => {
				const output = await run({
					resource: subject.resource,
					operation: 'delete',
					[subject.idParameter]: recordId,
				});
				const result = output[0].json as Record<string, unknown>;
				expect(result.deleted).toBe(true);
				expect(result.id).toBe(recordId);
				cleanup.splice(
					cleanup.findIndex((entry) => entry.id === recordId),
					1,
				);
			});
		});
	}
});
