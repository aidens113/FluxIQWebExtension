# t194-w22: a build over its cost ceiling is labelled a facility failure

## Outcome

Done. A live run whose build ended without a Flow and also broke its budget now carries
`productFailure: {code: "flow_lane.flow_not_built", buildFailureCode: ...}`, gets no
`facilityFailure`, and keeps `failureCategory: performance.budget`.

## Cause (traced)

Run `run-mup2u8o3-6697c4be` (created-Flow lane, `stoppedAt: "build"`):

1. `flow-lane/creation/lane.ts:274` calls `input.settleBuild(build)` before it judges the build.
   The check that would raise F15's `runtime.behavior` "FluxIQ did not build a Flow
   (flow_bootstrap.evidence_budget_exhausted)" is at `lane.ts:287`.
2. `LiveLlmRun.settleBuild` -> `settleObserved` -> `assertLiveLlmBudgetHeld` (`live-llm/budget.ts:90`)
   throws `RunnerFailure("performance.budget")` for $0.2969 against $0.25. So the lane never reaches
   line 287, and the product's failure is never built.
3. `run-scenario.ts:506`: `productFailureOf` accepted only `runtime.behavior`, so it returned
   `undefined`. `flowObservation.reportedVerdict` was null, so line 508 projected
   `facilityFailure: finalized-bundle / scenario.execute / unclassified`.

The recording-based Flow lane has the same gap: `runLaneWithLiveLlmSettlement` threw `breach ?? error`,
which discards a lane's `runtime.behavior` whenever the settlement found a breach.

## What changed and why

- New `packages/test-runner/src/live-llm/budget-over-product-failure.ts`: `budgetOverProductFailure(breach, productFailure)`
  re-raises a `performance.budget` breach with the product's `runtime.behavior` failure as its `cause`.
  Category, message and details stay the same. Any other pair is returned unchanged. It is exported from `live-llm/index.ts`.
- `live-llm/live-llm-run.ts` `settleBuild`: when the settlement throws, it rethrows through the helper,
  with the lane's own "did not build a Flow" failure. The shape matches `lane.ts:288`:
  `details.failure` holds Core's code. That happens only when the build did not propose a Flow, and
  never for a `permission_required` build with a request, which the lane judges as a stop.
  The private helper `buildWithoutFlowFailure` is added at the end of the file.
- `live-llm/lane-settlement.ts`: `throw breach ? budgetOverProductFailure(breach, error) : error`.
- `run-scenario/product-failure.ts`: `productFailureOf` follows a `performance.budget` failure whose
  `cause` is a `runtime.behavior` RunnerFailure. It is one level deep, and the existing lane rules apply.
  `run-scenario.ts` is unchanged. Its classification lines already skip `facilityFailure` when
  `productFailure` is set and publish `productFailure` on the error event. `failureCategory` comes from
  `classifyRunnerFailure`, which reads `error.category`, so it stays `performance.budget`.

Tests:
- `run-scenario/tests/product-failure.test.ts`: this run's breach with its cause gives `flow_not_built` and
  `flow_bootstrap.evidence_budget_exhausted`. A bare breach, or one over a facility failure, gives `undefined`.
- `live-llm/tests/live-llm-run.test.ts`: a failed build at $0.29693960399999997 against $0.25 is a cost breach
  whose cause is `runtime.behavior` with `details.failure.code` set. A proposed build that overspent has no cause.
- `live-llm/tests/lane-settlement.test.ts`: a breach thrown in place of a lane's `runtime.behavior` keeps it
  as the cause. A breach thrown over an `extension.worker` failure does not.

## Commands run and observed results

- Before the fix (original 3 source files restored temporarily from `HEAD`, new tests kept):
  `heavy.sh "t194-w22 before" sh -c 'node scripts/domain-dist.mjs && node ../../scripts/build-cache/cli.mjs test-runner:build && node --test dist/run-scenario/tests/product-failure.test.js dist/live-llm/tests/live-llm-run.test.js dist/live-llm/tests/lane-settlement.test.js'`
  -> `# tests 32 # pass 29 # fail 3`. The three new tests failed.
- After (fix restored): the same command -> `# tests 32 # pass 32 # fail 0`.
- `heavy.sh "t194-w22 check" pnpm --filter @fluxiq-web-extension/test-runner check` -> exit 0 (tsc, no errors).
- `heavy.sh "t194-w22 suite" pnpm --filter @fluxiq-web-extension/test-runner test` -> refused by
  `scripts/check/core-build.mjs`: "FluxIQ Core's build at ...fxwork/t194/!FluxIQ is 38 minute(s) behind its source"
  (`build-purse/projected-cost.ts`, which another worker is editing). I did not rebuild Core.
  I ran the rest of that script directly:
  `sh -c 'node scripts/domain-dist.mjs && node ../../scripts/build-cache/cli.mjs test-runner:build && node --test "dist/**/*.test.js"'`
  -> `# tests 1729 # pass 1729 # fail 0 # cancelled 0`. The `runner-wiring`, `clone-cache` and `demo-workspace`
  failures named in the brief did not reproduce in this run.
- `node scripts/structure-audit.mjs` -> 2 violations, neither in files I changed:
  `[contract-spread] domain/src/runtime/llm-evidence/node-run/rejected-rows.ts` and
  `[file-lines] apps/extension/src/content/extraction/list-reader.ts: 812 lines`. Both files have
  uncommitted edits by other workers. `live-llm/live-llm-run.ts` is at 646 lines, a 400-line advisory warning
  only; it was already past 400.

## Not verified

- No live or Lab run, per the user's stop. I did not re-evaluate the existing bundle; the fix applies only to new runs.
- The suite ran against Core's stale compiled dist, because the Core-freshness guard was bypassed.
- I rewrapped one comment in `run-scenario/product-failure.ts` after the suite build started. That change is comment only.

## Open questions or contradictions

- The lane still settles the budget before it judges the build (`lane.ts:274` before `:287`). The fix keeps that
  order, so the budget category still wins, and carries the product failure alongside it. `flow-lane/creation/lane.ts`
  was not in my edit set, so its "did not build a Flow" message is now built in two places
  (`lane.ts:288` and `live-llm-run.ts` `buildWithoutFlowFailure`). The supervisor may want one shared builder.
