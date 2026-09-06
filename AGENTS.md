# Orchestrator and builder workflow

The human user and primary Codex agent are co-orchestrators. Exactly one implementation agent, `builder` (Galileo), may work at a time using `gpt-5.6-sol` with low reasoning. The builder implements bounded assignments; the primary agent reviews requirements, diffs, and verification; the human performs final PR review and merge.

Preserve unrelated changes. Tests are strict TypeScript `*.test.ts` under Vitest; `.mjs` is reserved for direct-execution tooling. Use package scripts for validation. Never publish, tag, push, open a PR, or release without explicit authorization, and follow `RELEASING.md`.
