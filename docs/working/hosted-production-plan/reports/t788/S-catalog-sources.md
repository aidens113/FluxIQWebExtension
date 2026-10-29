# t788-S catalog sources

Outcome: Done.

Changed (Core, task/t788 tree): contracts catalog-entry.ts (`sources` array, min 1, max 16; every endpoint source must yield the action) and its test; catalog/generate-iam-action-catalog.ts (one entry per action, sources ordered by programId then endpoint); new catalog/catalog-source-limit-error.ts (IamCatalogSourceLimitError, typed, thrown at >16) plus barrel; render/action-catalog-module.ts (one entry per line, since the indented form was 3715 lines and failed the 800-line audit; now 235); tests (merge, >16 typed error, live drift check); packages/contracts/src/iam/actions.generated.ts written via FLUXIQ_REGENERATE_IAM_CATALOG=1 vitest; docs/architecture/platform.md; docs/reference regenerated.

Validation: contracts test 488 pass; src/platform/iam both groups pass; structure:check passed; docs:reference then docs:check current; pnpm check exit clean.
Drift: live-registry test fails if actions.generated.ts is stale (same mechanism as the other generated lists).
Not verified: actions.generated.ts is not exported from the contracts barrel (nothing consumes it yet). Empty sources is refused by the schema (tested), not by the generator.
