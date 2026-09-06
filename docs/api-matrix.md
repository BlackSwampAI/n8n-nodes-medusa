# API matrix

The node targets the public Medusa v2 Admin API. Integration evidence comes from the pinned disposable Medusa harness, not a hosted production instance.

| Resource families                            | Advertised operations                               | Contract / observed status                                              |
| -------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| Product, Variant, Category, Collection       | CRUD, listing, membership                           | Public Admin API; exercised against disposable v2 fixtures              |
| Customer, Customer Group                     | CRUD, listing, memberships                          | Public Admin API; exercised against disposable v2 fixtures              |
| Inventory Item, Stock Location               | CRUD, levels, channel assignment                    | Public Admin API; destructive level semantics require live verification |
| Order, Fulfillment                           | Reads, supported transitions, fulfillment lifecycle | Public Admin API; no order create/delete is advertised                  |
| Region, Sales Channel, Price List, Promotion | CRUD and supported commerce operations              | Public Admin API; conditional requirements have resource-specific tests |

Known product follow-ups, intentionally unchanged here: resource-locator normalization is not uniform across every ID input; Base URL/path edge cases and delete-success semantics require continued contract testing; metadata/executor required-field and blank-state coverage is resource-specific rather than one complete operation table. Current Medusa behavior beyond the pinned v2 fixture remains unverified.
