# Releasing

This established package publishes only from the tag-triggered GitHub Actions workflow using npm Trusted Publisher/OIDC and provenance. Do not publish locally and do not add `NPM_TOKEN`.

Before an authorized release, update package/lock versions and CHANGELOG, then run the complete format, lint, strict typecheck, Vitest, build, source scan, release audit, package check, and load/install smoke gates. Confirm CI on the exact commit and create the immutable matching `v<version>` tag.

The workflow validates the tag, prepares tokenless npm authentication, and publishes once. Its separate dependent `verify-published` job runs the registry/provenance scanner. If only verification fails, GitHub Actions **Re-run failed jobs** safely reruns that job without invoking `npm run release`; never rerun the successful publish job for an immutable version. Require exact scanner success text; exit status alone is insufficient.

Submit only the exact published version to Creator Portal, then visually inspect and record the card version and logo. Portal state may remain stale or generic even when the tarball contains valid icons.
