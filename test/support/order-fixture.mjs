// Builds everything Medusa needs before an order can exist, then places orders through the Store
// API. There is no admin route that creates an order — checkout is the only path — and the chain
// below is the minimum that produces one. Every step was established against a live server; the
// two that are easy to miss are marked.
//
// Kept in JavaScript for the same reason as the other support modules: the n8n community-node lint
// rules ban `process` and node builtins in every .ts file. See CONTRIBUTING.md.
export async function buildOrderFixture(base, token, prefix) {
	let pubKey = null;
	const admin = async (p, i = {}) => {
		const r = await fetch(base + p, {
			...i,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Basic ${token}`,
				...(i.headers || {}),
			},
		});
		const t = await r.text();
		let b;
		try {
			b = JSON.parse(t);
		} catch {
			b = t;
		}
		return { s: r.status, b };
	};
	const store = async (p, i = {}) => {
		const r = await fetch(base + p, {
			...i,
			headers: {
				'Content-Type': 'application/json',
				...(pubKey ? { 'x-publishable-api-key': pubKey } : {}),
				...(i.headers || {}),
			},
		});
		const t = await r.text();
		let b;
		try {
			b = JSON.parse(t);
		} catch {
			b = t;
		}
		return { s: r.status, b };
	};
	const must = (n, r) => {
		if (r.s >= 400) throw new Error(`${n} failed [${r.s}]: ${JSON.stringify(r.b).slice(0, 200)}`);
		return r.b;
	};

	const sc = must(
		'sales channel',
		await admin('/admin/sales-channels', {
			method: 'POST',
			body: JSON.stringify({ name: `${prefix} ch` }),
		}),
	).sales_channel;
	const key = must(
		'publishable key',
		await admin('/admin/api-keys', {
			method: 'POST',
			body: JSON.stringify({ title: `${prefix} pk`, type: 'publishable' }),
		}),
	).api_key;
	pubKey = key.token;
	must(
		'link key',
		await admin(`/admin/api-keys/${key.id}/sales-channels`, {
			method: 'POST',
			body: JSON.stringify({ add: [sc.id] }),
		}),
	);
	// A country belongs to exactly one region, so a second run cannot create another region for
	// "us". Reuse whichever region already covers it, and only create one on a fresh database.
	const existingRegions = must(
		'list regions',
		await admin('/admin/regions?limit=100&fields=id,name,*countries'),
	).regions;
	const covering = existingRegions.find((r) => (r.countries ?? []).some((c) => c.iso_2 === 'us'));
	const region =
		covering ??
		must(
			'region',
			await admin('/admin/regions', {
				method: 'POST',
				body: JSON.stringify({ name: `${prefix} US`, currency_code: 'usd', countries: ['us'] }),
			}),
		).region;
	const regionWasReused = Boolean(covering);
	const loc = must(
		'stock location',
		await admin('/admin/stock-locations', {
			method: 'POST',
			body: JSON.stringify({ name: `${prefix} wh` }),
		}),
	).stock_location;
	must(
		'link loc',
		await admin(`/admin/stock-locations/${loc.id}/sales-channels`, {
			method: 'POST',
			body: JSON.stringify({ add: [sc.id] }),
		}),
	);
	// Providers must be enabled at the location or shipping options are rejected later.
	must(
		'enable provider',
		await admin(`/admin/stock-locations/${loc.id}/fulfillment-providers`, {
			method: 'POST',
			body: JSON.stringify({ add: ['manual_manual'] }),
		}),
	);
	must(
		'fulfillment set',
		await admin(`/admin/stock-locations/${loc.id}/fulfillment-sets`, {
			method: 'POST',
			body: JSON.stringify({ name: `${prefix} fs`, type: 'shipping' }),
		}),
	);
	// The create response does not expand fulfillment_sets, so read it back.
	const withSets = must(
		'read location',
		await admin(`/admin/stock-locations/${loc.id}?fields=id,*fulfillment_sets`),
	).stock_location;
	const fsId = withSets.fulfillment_sets[0].id;
	const zone = must(
		'service zone',
		await admin(`/admin/fulfillment-sets/${fsId}/service-zones`, {
			method: 'POST',
			body: JSON.stringify({
				name: `${prefix} zone`,
				geo_zones: [{ type: 'country', country_code: 'us' }],
			}),
		}),
	).fulfillment_set.service_zones.slice(-1)[0];
	const profile = must(
		'shipping profile',
		await admin('/admin/shipping-profiles', {
			method: 'POST',
			body: JSON.stringify({ name: `${prefix} prof`, type: 'default' }),
		}),
	).shipping_profile;
	must(
		'shipping option',
		await admin('/admin/shipping-options', {
			method: 'POST',
			body: JSON.stringify({
				name: `${prefix} standard`,
				service_zone_id: zone.id,
				shipping_profile_id: profile.id,
				provider_id: 'manual_manual',
				price_type: 'flat',
				type: { label: 'Standard', description: 'std', code: 'standard' },
				prices: [{ currency_code: 'usd', amount: 5 }],
				rules: [],
			}),
		}),
	);
	const product = must(
		'product',
		await admin('/admin/products', {
			method: 'POST',
			body: JSON.stringify({
				title: `${prefix} widget`,
				status: 'published',
				shipping_profile_id: profile.id,
				sales_channels: [{ id: sc.id }],
				options: [{ title: 'Size', values: ['One'] }],
				variants: [
					{
						title: 'One',
						options: { Size: 'One' },
						manage_inventory: false,
						prices: [{ currency_code: 'usd', amount: 20 }],
					},
				],
			}),
		}),
	).product;

	const makeOrder = async (n = 1) => {
		const cart = must(
			'cart',
			await store('/store/carts', {
				method: 'POST',
				body: JSON.stringify({
					region_id: region.id,
					sales_channel_id: sc.id,
					email: `${prefix}${n}@example.com`,
				}),
			}),
		).cart;
		must(
			'line item',
			await store(`/store/carts/${cart.id}/line-items`, {
				method: 'POST',
				body: JSON.stringify({ variant_id: product.variants[0].id, quantity: 2 }),
			}),
		);
		must(
			'addresses',
			await store(`/store/carts/${cart.id}`, {
				method: 'POST',
				body: JSON.stringify({
					shipping_address: {
						first_name: 'Ada',
						last_name: 'L',
						address_1: '1 Main',
						city: 'Toledo',
						country_code: 'us',
						postal_code: '43604',
					},
					billing_address: {
						first_name: 'Ada',
						last_name: 'L',
						address_1: '1 Main',
						city: 'Toledo',
						country_code: 'us',
						postal_code: '43604',
					},
				}),
			}),
		);
		const opts = must(
			'shipping options',
			await store(`/store/shipping-options?cart_id=${cart.id}`),
		).shipping_options;
		must(
			'shipping method',
			await store(`/store/carts/${cart.id}/shipping-methods`, {
				method: 'POST',
				body: JSON.stringify({ option_id: opts[0].id }),
			}),
		);
		const pc = must(
			'payment collection',
			await store('/store/payment-collections', {
				method: 'POST',
				body: JSON.stringify({ cart_id: cart.id }),
			}),
		).payment_collection;
		must(
			'payment session',
			await store(`/store/payment-collections/${pc.id}/payment-sessions`, {
				method: 'POST',
				body: JSON.stringify({ provider_id: 'pp_system_default' }),
			}),
		);
		const done = must(
			'complete',
			await store(`/store/carts/${cart.id}/complete`, { method: 'POST' }),
		);
		if (!done.order)
			throw new Error('complete did not return an order: ' + JSON.stringify(done).slice(0, 200));
		return done.order;
	};

	return {
		admin,
		store,
		makeOrder,
		regionWasReused,
		ids: {
			sc: sc.id,
			key: key.id,
			region: region.id,
			loc: loc.id,
			profile: profile.id,
			product: product.id,
		},
	};
}
