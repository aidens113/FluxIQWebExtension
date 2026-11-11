# B4a: a held FluxNode spec follows the incoming spec

Outcome: Done.

## What changed and why
Core `packages/fluxiq/src/framework/automation-service/service/fluxnode/owner-flows.ts`:
- `registerNamed` takes an optional `update(held)`. `register(spec)` passes `respecified`: when `canonicalFluxNodeSpec(held.spec) === canonicalFluxNodeSpec(incoming)` it returns the held object (no write); otherwise it reads the Flow, replaces `metadata.fluxNode.spec` through `saveFlow` (same path as registration), and swaps the map entry for `{...held, spec}`. flowId, specHash, registeredAt, learned Flow and `latest` are untouched (an older hash stays non-latest). Comparison is canonical text only, so the `overrides` another worker adds to the canonical form is covered automatically.
- `created` stays `false` for an updated spec and no `updated` flag was added: no caller needs it (create-fluxnode-service.ts uses `.registered`, and `created` feeds only the register response). create-fluxnode-service.ts is unchanged.
- Pipelines: `registerPipeline` passes no `update` (its hash covers the whole pipeline), behaviour unchanged.
- Second root-cause defect found by the round-trip test and fixed: `projectId()` called `listProjects()` with no domain, which lists only projects with no domain, so a domain-scoped owner project ("FluxNodes") was never found after a restart and the registry silently started empty (a new project each time). Now `listProjects(this.domainId ?? null)`.

New test `tests/owner-flows-reregister.test.ts` (3 cases): changed options and hasCheck are held on the same Flow, an identical re-registration makes no `saveFlow` call, and a fresh `FluxNodeOwnerFlows` reads the new spec back; a changed spec under an older hash does not become latest; a run started with the same name+hash and `budgetUsd: 0` ends `budget_out` (uses the new options).

## Commands run
- Free memory before: ~2.7 to 3.7 GB (above 2.5 GB), so the narrow directory run was done.
- `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode` -> Test Files 4 passed (4), Tests 18 passed (18) (299 s).
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (529 warning(s), 969 baselined).`
- Earlier runs failed only on my test's own bad inputs (retries must be >= 3, judge enum auto/always/off) and on the domain-list defect above.

## Not verified
No typecheck, no whole suite (per brief). The "run uses new options" test checks budgetUsd 0 only, not options/hasCheck behaviour in a full run.

## Open questions
None. Note for the overrides worker: nothing to do here; once `overrides` is in `canonicalFluxNodeSpec` and the parsed spec, a changed override is held automatically (the saved metadata spec is the whole parsed spec).
