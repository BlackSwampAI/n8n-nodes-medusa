# Contributing

## Requirements

- Node.js 22.22.0 or later
- Docker with the Compose plugin, for the integration environment

## Getting started

```bash
npm ci
npm run lint
npm run build
```

## Tests

```bash
npm run test              # everything
npm run test:unit         # no Medusa required
npm run test:integration  # requires a running Medusa (see below)
npm run test:watch
npm run typecheck
```

Unit tests cover the credential definition and the package's n8n registration. Integration tests
run against a real Medusa server and **skip rather than fail** when none is configured, so the
suite still runs for contributors without Docker.

Integration tests read `MEDUSA_BASE_URL` and `MEDUSA_API_TOKEN` from the environment, falling
back to `.env.test`.

### Writing tests under the n8n lint rules

The n8n community-node lint rules apply to **every `.ts` file in the repository**, and strict
mode forbids scoping them to `nodes/` and `credentials/`. In practice that means a `.ts` file
anywhere may not:

- use the `process` global, or
- import node builtins such as `node:fs` and `node:path`.

Test files are still TypeScript. Anything that needs those capabilities lives in a small
JavaScript module under `test/support/`, which the rules do not cover:

- `test/support/env.mjs` — reads `MEDUSA_BASE_URL` / `MEDUSA_API_TOKEN` and exposes `hasMedusa`
- `test/support/manifest.mjs` — reads `package.json` and resolves registered entry points

If a new test needs the filesystem or the environment, add it there rather than reaching for the
builtin directly, and keep the JSDoc types current so `npm run typecheck` stays useful.

## Medusa development environment

Integration work runs against a real, disposable Medusa server rather than mocks. It is defined
by `docker-compose.yml` and the pinned project in `test/medusa/`.

```bash
npm run medusa:up      # start Postgres and Medusa, then mint an admin API token
npm run medusa:down    # stop everything and delete the database volume
```

`medusa:up` is safe to re-run — migrations are idempotent and the admin user is only created if
it is missing. It writes credentials to `.env.test`, which is git-ignored:

```
MEDUSA_BASE_URL=http://localhost:9000
MEDUSA_API_TOKEN=sk_...
```

The first run builds the Medusa image and takes several minutes. Later runs start in seconds.

Ports: Medusa on `9000`, Postgres on `5433` — deliberately not 5432, so it cannot collide with a
Postgres already running on your machine.

### Why the bootstrap works the way it does

Medusa cannot mint its first credential over the API, because there is nothing to authenticate
with yet. `scripts/medusa-dev.mjs` therefore:

1. Creates an admin user with the Medusa CLI, inside the container.
2. Exchanges that user's password for a JWT at `POST /auth/user/emailpass`.
3. Uses the JWT to create a **secret** API key at `POST /admin/api-keys`.
4. Verifies the key over HTTP Basic, the same way the node's credential authenticates.

The secret key is what the node uses, because unlike a JWT it does not expire.

### Things that will confuse you if you change this setup

**`sslmode=disable` in `DATABASE_URL` is required.** Medusa's migration runner opens a second,
single-connection pool to hold an advisory lock. Without `sslmode=disable` that connection stalls
in an SSL handshake that never completes, and the migration fails after 60 seconds with
`Knex: Timeout acquiring a connection. The pool is probably full.` The message points at
connectivity, but Postgres is reachable the whole time and the server's own connection works.

**Migrations run as their own one-shot `migrate` service.** Running them inside the server's
start-up hides failures behind a server that simply never turns healthy.

**`/admin/users/me` is not a valid probe for a secret API key.** A secret key authenticates as an
API key rather than as a user, so the route has no user to resolve and returns 404 even for a
valid key. Use a normal collection route such as `/admin/users?limit=1`.

**`test/medusa/medusa-config.js` is CommonJS, not TypeScript, on purpose.** The n8n
community-node lint rules apply to every `.ts` file in the repository, and they cannot be scoped
to `nodes/` and `credentials/` because n8n's strict mode rejects any modification to
`eslint.config.mjs`. A `.ts` config here would be linted as if it were node source and fail for
importing Medusa packages and reading `process.env`. Keep this directory free of TypeScript.

**The admin dashboard is disabled** in `test/medusa/medusa-config.ts`. Building it pulls in React
and Vite and adds minutes to every cold start, and the Admin API does not need it.

**The Medusa version is pinned** in `test/medusa/package.json`. Medusa ships frequently, and an
integration suite that silently follows the latest release fails for reasons unrelated to this
node. Upgrade deliberately.

## Branching

Work happens on `feat/`, `chore/`, `fix/`, `docs/` or `test/` branches, never directly on `main`.
Pull requests are opened as drafts and merged by a maintainer.
