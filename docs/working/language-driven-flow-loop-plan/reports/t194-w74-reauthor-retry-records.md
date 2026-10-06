# t194-w74: re-author retry only when it may pass; tries told apart

## Outcome

Partial. The three items are done and every test in the brief's validation directories passes (56 files, 636 tests). One integration test outside my owned paths now fails because it relied on the old retry: `runtime/tests/refuted-result/tests/repair-purse-chain.test.ts`, "is capped at a Flow's $0.10, re-author, retry and patch ladder together". Details are under Open questions.

## What changed and why

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`, R = `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `R/service/runtime-adaptation/reauthor-build.ts`
  - New `automationStudioReauthorMayPassAgain(failure)` decides whether to build again. It no longer goes by `retryable` alone. The failure must still be `retryable: true`. On top of that:
    - A failure with an `ending` is built again only when `ending.kind === "provider_unavailable"`. These endings are never built again: `budget_exhausted` (any bound), `not_doable`, `not_finished` and `replies_unreadable`.
    - A failure without an ending is built again only at stage `provider_request`, `provider_resolution` or `pre_provider_validation`, meaning the provider or transport failed, or the build never reached the model. Nothing at `provider_output_validation` is built again: `evidence_iteration_limit`, unusable decisions and invalid plans all stay at one try.
  - The code comment says why. `retryable` answers whether an operator's later retry could pass (with a larger budget, or once the provider is back). It does not answer whether building again now, on the same brief with less money, could pass. It cites run-musp39u8 ($0.0496 and then $0.0439 spent on the same ground).
  - The purse accounting is unchanged: the same charge after each build and the same cost-bound refusal.
  - `build(tryNumber)`: the second build's result carries `try: 2`. `AutomationStudioReauthorBuilt` gains an optional `try?: number`. Both ports already spread `built` into `automationStudioRefutedResultReauthored`, so neither port needed editing.
  - Each try writes trace lines through `automationStudioReauthorTryTrace`, imported from `../../llm/evidence-progress/index.ts`. It cannot come from `llm/index.ts`, which does not re-export evidence-progress. This adds no cycle: evidence-progress imports only step-log and decision-dump, and `tsc` is clean. A try the purse refuses is traced as well: `code=llm_budget.run_cost_limit bound=cost`.
- `R/recovery/refuted-result/reauthor.ts`: `automationStudioRefutedResultReauthored` takes an optional `try`. It writes the field on that attempt's entry and on the top-level marker only when it is set. The first try's entry is unchanged and keeps its `ending`.
- `R/llm/evidence-progress/progress-trace.ts`: new `automationStudioReauthorTryTrace(event, env, write)` and its event type. It uses the same switch (`FLUXIQ_BUILD_PROGRESS_TRACE=1`) and the same prefix as the loop lines. The lines look like this:
  - `[FluxIQ build-trace] <iso> reauthor try start try=N`
  - `... reauthor try end try=N ms=<n> code=<code|-> ending=<kind|-> bound=<bound|-> again=0|1`, or `applied=1` in place of `again=` when the build applied.

  Each value goes through `codeOf`/`numberOf`, so the line holds no free text.
- `R/service/runtime-adaptation/tests/reauthor-build.test.ts` (new, 11 tests):
  - A first build ending `budget_exhausted` with bound `rounds` is not built again, and its record keeps `ending`.
  - These are not built again either: `not_doable`, `not_finished`, `replies_unreadable`, `budget_exhausted/cost`, `evidence_iteration_limit`.
  - A first build ending `provider_unavailable` is built again once. The second entry and the marker carry `try: 2`, and the first entry has no `try`.
  - A `provider_timeout` is built again with `try: 2`.
  - Trace lines appear when the trace is on (4 for two tries, 2 for the rounds case, with `bound=rounds again=0`) and do not appear when it is off.
- `R/service/runtime-adaptation/tests/refuted-result-port.test.ts`: the "repair's one purse" fixtures used `evidence_iteration_limit` as the "may pass" failure, which is no longer built again. The `outOfTurns` helper now builds a `provider_unavailable` ending that reports the same cost, so these purse scenarios still exercise a retry. One `afterCode` was changed to `flow_bootstrap.provider_unavailable`. The directly constructed error in "starts no later part…" became `provider_network_error` at `provider_request`. The purse expectations themselves were not changed.

## Commands run and observed results

All commands ran in `packages/fluxiq`.

- Tests first: `npx vitest run src/.../service/runtime-adaptation/tests/reauthor-build.test.ts` printed `9 failed | 2 passed (11)`. The failures were "spy called 2 times", missing `try`, and no trace lines. The two that passed were not_doable (already not retried) and trace-off.
- After the change, the same command printed `11 passed (11)`.
- Brief validation: `npx vitest run src/programs/automation-studio/runtime/service/runtime-adaptation src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/llm/evidence-progress` printed `Test Files 56 passed (56)` and `Tests 636 passed (636)`. An intermediate run, before the port fixtures were updated, showed 5 failures in refuted-result-port, all caused by the fixture relying on the iteration-limit retry.
- `npx tsc --noEmit -p tsconfig.json` printed 0 `error TS` lines across the whole package.
- `node scripts/structure-audit.mjs` (Core root) printed one violation, `[failure-as-empty] runtime/activity/run.ts:80`. That file is not mine; it is another worker's in-flight edit. None of my files are flagged.
- Extra run outside the brief: `npx vitest run src/programs/automation-studio/runtime/tests/refuted-result` printed `1 failed | 32 passed (33)`. See Open questions.

## Not verified

- No live run. The trace lines and the `try: 2` record have not been seen in a real `core.log` or `decision-trace.json`.
- The full package suite was not run (by policy).

## Open questions or contradictions found

- `runtime/tests/refuted-result/tests/repair-purse-chain.test.ts:197` expects `purse` to match `{ limitUsd: 0.1, bound: "cost" }`. It now gets `spentUsd: 0.09` with no `bound`. Its scripted first build evidently ends at its own limit, and the old code built it again until the purse ran out. Under the new rule that second build does not happen, so the purse is never exhausted. The cap assertions in the same test still hold (`repairSpend <= 0.1`, `spentUsd <= 0.1`).
  - The file is outside my owned paths. The supervisor, or whoever owns that file, should make one of two changes:
    - Drop `bound: "cost"` and assert one re-author attempt.
    - Script that harness's first build to end `provider_unavailable`, so the retry still happens.
- `flow-bootstrap/generation-failure/failure-state.ts` still publishes `retryable: true` for `evidence_budget_exhausted`, `build_not_finished`, `model_replies_unreadable` and `evidence_iteration_limit`. That is still correct for an operator retry with a larger budget, and I left it unchanged. The re-author no longer reads the flag that way.
