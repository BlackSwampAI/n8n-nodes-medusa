# Releasing

This established package publishes only from the tag-triggered GitHub Actions workflow using npm Trusted Publisher/OIDC and provenance. Do not publish locally and do not add `NPM_TOKEN`.

Before an authorized release, update package/lock versions and CHANGELOG, then run the complete format, lint, strict typecheck, Vitest, build, source scan, release audit, package check, and load/install smoke gates. Confirm CI on the exact commit and create the immutable matching `v<version>` tag.

The workflow validates the tag, prepares tokenless npm authentication, publishes, and runs the registry/provenance scanner. Require its exact success text; exit status alone is insufficient. If publication succeeded but a later gate failed, increment and fix forward rather than rerunning an immutable version.

Submit only the exact published version to Creator Portal, then visually inspect and record the card version and logo. Portal state may remain stale or generic even when the tarball contains valid icons.
