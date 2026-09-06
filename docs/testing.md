# Testing

Unit tests are strict TypeScript `*.test.ts` under Vitest 4.1.11. CI runs formatting, n8n lint, production and test typechecking, unit tests, build, official scanner source/built preflight, release audit, package validation, compiled load, and isolated packed-install smoke on Node 22.22 and 24.

Integration tests are destructive and fail closed unless `MEDUSA_BASE_URL` is loopback, credentials are present, and `MEDUSA_DISPOSABLE_TEST_ENV=true`. CI provisions the disposable Docker fixture and sets the marker only for that job. Fixtures use owned records and cleanup stacks. Never point these tests at a hosted or production instance.

Package smokes use no real credentials. Actual n8n browser/editor interaction and current hosted Medusa compatibility remain separate human qualification items; this migration adds no new editor evidence.

After submitting only the exact published version, visually record the Creator Portal card version and logo. Tarball icon checks cannot prove portal rendering or freshness.

The published-package scanner retries only narrowly recognized propagation failures. This includes
the short-lived 404 observed when npm provenance was already present but its newly attested public
GitHub source was not yet fetchable; policy, lint, authorization, and unrelated failures remain
immediate.
