# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Product Category and Product Collection resources, each with Create, Get, Get Many, Update,
  Delete and an Add Products operation that adds and removes members in one call.
- Product Variant resource with Create, Get, Get Many, Update and Delete operations, addressed
  through the parent product.
- Product resource with Create, Get, Get Many, Update and Delete operations, including filters for
  search, status, handle, category, collection and created/updated dates.
- Shared transport for the Medusa Admin API: base URL normalisation, a reusable pagination loop
  over Medusa's `limit`/`offset`/`count` envelope, and error mapping that tells authentication
  failures, missing records, validation failures and connection problems apart.
- Shared `Return All` / `Limit` and list `Options` field definitions for resource operations.
- Medusa node and `medusaApi` credential scaffold targeting the Medusa v2 Admin API.
- Disposable Medusa integration environment (`docker-compose.yml`, `test/medusa/`) with
  `npm run medusa:up` and `npm run medusa:down`, which bootstrap an admin user and a secret API
  key and write them to `.env.test`.
- `CONTRIBUTING.md` documenting the environment and its non-obvious constraints.

### Fixed

- The credential test probed `GET /admin/users/me`, which returns 404 for a valid secret API key
  because such a key authenticates as an API key rather than as a user. Every correct credential
  was reported as broken. It now probes `GET /admin/users?limit=1`.

### Changed

- Test suite (Vitest) with unit and integration layers, a `typecheck` script, and CI that runs
  formatting, lint, typecheck, unit tests, build, release audit, and integration tests against a
  real Medusa server.
- Renamed the package to `@blackswampai/n8n-nodes-medusa`.
- Widened the release audit's package-name check to accept scoped `@scope/n8n-nodes-*` names.

### Removed

- The `GithubIssues` and `Example` template nodes, their credentials, icons, and `README_TEMPLATE.md`.
