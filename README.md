# @blackswampai/n8n-nodes-medusa

This is an n8n community node. It lets you use [Medusa](https://medusajs.com/) in your n8n workflows.

Medusa is an open source, self-hostable commerce platform built as a modular set of commerce
primitives — products, orders, inventory, fulfillment, pricing and promotions — exposed through
an API-first Admin API. This node targets that Admin API, so it works against any Medusa
installation you control, self-hosted or otherwise.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Known limitations](#known-limitations)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation, using the package name:

```
@blackswampai/n8n-nodes-medusa
```

## Operations

The node targets Medusa's Admin API. Support is being added a resource at a time; this section
lists what is available in the current release.

No operations are available yet. The first release will cover:

- **Catalog** — Product, Product Variant, Product Category, Product Collection
- **Customers** — Customer, Customer Group
- **Orders** — read, update, cancel, complete, archive, and order fulfillment actions
- **Inventory** — Inventory Item, location levels, Stock Location
- **Commerce configuration** — Region, Sales Channel, Price List, Promotion

Medusa's Store API — carts, checkout and storefront browsing — is out of scope.

## Credentials

You need a Medusa **secret API key**. Publishable API keys are scoped to sales channels for
storefront use and will not authenticate against the Admin API.

1. Sign in to your Medusa admin dashboard as an administrator.
2. Go to **Settings → Secret API Keys** and create a key.
3. Copy the token when it is shown. Medusa displays it once.

The credential takes two fields:

| Field     | Value                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL  | The root URL of your Medusa server, without the `/admin` path — for example `https://commerce.example.com` or `http://localhost:9000` |
| API Token | The secret API key token                                                                                                              |

Medusa's Admin API authenticates secret keys using the HTTP `Basic` scheme. The node sets that
header for you; you only supply the token.

## Compatibility

- Requires n8n with `n8nNodesApiVersion` 1.
- Requires Node.js 22.22.0 or later.
- Developed and tested against Medusa 2.x. Medusa v1 uses a different Admin API and is not supported.

## Known limitations

Medusa has no generic outgoing webhook registration. Its events are emitted through the Event
Module to subscribers that run inside the Medusa application itself, so there is no Admin API
route an external system can call to subscribe. This node therefore has no trigger — it is an
action node. Event-driven support depends on a companion Medusa plugin that forwards events over
HTTP, which is planned separately.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Medusa Admin API reference](https://docs.medusajs.com/api/admin)
- [Medusa documentation](https://docs.medusajs.com/)

## Version history

### 0.1.0

Initial release.

## License

[MIT](LICENSE.md)
