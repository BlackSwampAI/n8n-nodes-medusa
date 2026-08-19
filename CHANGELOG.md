# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Medusa node and `medusaApi` credential scaffold targeting the Medusa v2 Admin API.
- Disposable Medusa integration environment (`docker-compose.yml`, `test/medusa/`) with
  `npm run medusa:up` and `npm run medusa:down`, which bootstrap an admin user and a secret API
  key and write them to `.env.test`.
- `CONTRIBUTING.md` documenting the environment and its non-obvious constraints.

### Changed

- Renamed the package to `@blackswampai/n8n-nodes-medusa`.
- Widened the release audit's package-name check to accept scoped `@scope/n8n-nodes-*` names.

### Removed

- The `GithubIssues` and `Example` template nodes, their credentials, icons, and `README_TEMPLATE.md`.
