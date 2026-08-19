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

### Product

| Operation | Notes                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Create    | Requires a title and at least one priced variant                                                      |
| Get       | By ID, with optional field selection and relation expansion                                           |
| Get Many  | Filter by search, status, handle, category, collection, and created/updated date; Return All or Limit |
| Update    | Any subset of title, subtitle, description, handle, status, discountable, external ID and metadata    |
| Delete    | By ID                                                                                                 |

Medusa requires every product to declare at least one option axis, and every variant to carry
matching option values. Rather than make that mandatory, the node derives a single axis from your
variant titles, so creating a product needs only a title, a variant name and a price. Products
that genuinely vary along several dimensions — size _and_ colour — can supply the axes explicitly
through the Product Options and Variant Options fields.

### Product Variant

| Operation | Notes                                                                        |
| --------- | ---------------------------------------------------------------------------- |
| Create    | On an existing product; requires a title and at least one price              |
| Get       | By product ID and variant ID                                                 |
| Get Many  | Variants of one product, or across every product when no product ID is given |
| Update    | Title, SKU, barcodes, inventory tracking, metadata, and the full price list  |
| Delete    | By product ID and variant ID                                                 |

Variants are always addressed through their product, because that is how Medusa's API is shaped.
The cross-product route used by Get Many is the one exception, and it cannot filter by product —
supply a Product ID and the node switches to that product's own route instead.

Medusa will not invent option values. A variant can only use option values already declared on its
product, so add the value to the product first if it is new.

### Product Category

| Operation    | Notes                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| Create       | Requires a name                                                        |
| Get          | By ID                                                                  |
| Get Many     | Filter by search, handle, parent category, active and internal flags   |
| Update       | Name, description, handle, ranking, parent, visibility flags, metadata |
| Delete       | By ID                                                                  |
| Add Products | Add and remove products in one call                                    |

Medusa creates categories **inactive**. Set Is Active for the category to appear in a storefront.

### Product Collection

| Operation    | Notes                               |
| ------------ | ----------------------------------- |
| Create       | Requires a title                    |
| Get          | By ID                               |
| Get Many     | Filter by search, title, handle     |
| Update       | Title, handle, metadata             |
| Delete       | By ID                               |
| Add Products | Add and remove products in one call |

### Customer

| Operation  | Notes                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| Create     | Requires an email                                                                |
| Get        | By ID                                                                            |
| Get Many   | Filter by search, exact email, company, account status, and created/updated date |
| Update     | Email, name, company, phone, metadata                                            |
| Delete     | By ID                                                                            |
| Set Groups | Add and remove group membership in one call                                      |

Medusa will accept a customer with no fields at all, creating a record that cannot be contacted or
matched against an existing one. The node requires an email to prevent that.

### Customer Group

| Operation     | Notes                                      |
| ------------- | ------------------------------------------ |
| Create        | Requires a name                            |
| Get           | By ID                                      |
| Get Many      | Filter by search, exact name, created date |
| Update        | Name, metadata                             |
| Delete        | By ID                                      |
| Set Customers | Add and remove members in one call         |

Membership can be changed from either end — Customer → Set Groups, or Customer Group → Set
Customers — whichever fits the workflow better.

More resources are being added a milestone at a time. Planned for the first release:

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
