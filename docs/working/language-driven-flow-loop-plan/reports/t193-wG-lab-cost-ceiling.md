# t193-wG: Lab cost ceiling to $0.25

## Outcome

Done. The Lab's total ceiling is now Core's $0.25, the Flow gets that value as `maxEstimatedCostUsdPerRun`, and the demo creation total is $0.25. The budget check already ran per phase, so it did not need a change. One departure from the brief: I did not run the brief's `pnpm --filter ... build`. A live run was executing `dist/cli.js` from this tree (PID 9064, bigbox-retail, lab slot-2), and that build starts with `clean-dist`, which deletes `dist/`. I compiled the same `tsconfig.json` into a scratch outDir instead (see Commands).

## What changed and why

- `packages/test-runner/src/live-llm/live-llm-plan.ts`: `LAB_MAX_TOTAL_COST_USD = 2` is now `CORE_MAX_TOTAL_COST_USD = 0.25`. It is defined once, and its doc says it is Core's ceiling for one build and, separately, for one repair. `maxTotalEstimatedCostUsd = min(0.25, per-call × calls)`. `flow-settings.ts` needed no change: it already writes `plan.maxTotalEstimatedCostUsd` to `adaptationPolicySettings.maxEstimatedCostUsdPerRun` and reads it back.
- `packages/test-runner/src/live-llm/budget.ts`: only a comment and the breach wording changed ("held to Core's ceiling"). The comment now says the ceiling is judged per phase.
- **Task 2 finding: the check was already per phase, not summed.**
  - `settleBuild` passes `liveLlmBuildUsage(build)`, which is only the build's own totals, to `assertLiveLlmBudgetHeld(this.plan, …)` through `settleObserved`.
  - `settleRepair` passes `liveLlmObservedUsage(<repair run detail>)`, which is only the repair run's usage, to `assertLiveLlmBudgetHeld(this.repairPlan, …)`. `repairPlan` is `{...plan, task: "repair", purpose: "explore_and_adapt"}`, so it has the same $0.25 total.
  - The existing test "…settles that spend beside the build" already asserted that the repair snapshot does not fold in the build's totals. `live-llm-run.ts` was not edited.
- `packages/test-runner/src/demo-llm-create-ui/limits.ts`: `EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalEstimatedCostUsd` went from 1 to 0.25, with a comment. It is read by `explore-proposal-ui.ts:294`, the aggregate-bound check on a proposal's cost. It is also read by `demo-llm-exploration-request.ts:106`, the `providerBudget` sent to the panel. Neither file needed editing.
- **Other Lab default totals above $0.25:** only the two above (plan `2`, limits `1`). A search of `packages/`, `scripts/` and `apps/scenario-lab/src` found no other `maxTotalEstimatedCostUsd` or `maxEstimatedCostUsdPerRun` default. The per-call caps were already 0.25.
- Tests:
  - `live-llm/tests/live-llm-plan.test.ts`:
    - New: "a build of 64 calls at $0.25 each is allowed $0.25 in all…".
    - Updated the $2/$1/$0.48 expectations to 0.25. Added a 20 × $0.01 = $0.20 case to show a smaller operator number is kept.
  - `live-llm/tests/live-llm-run.test.ts`:
    - New: "a build and its repair are each held to $0.25 on its own…". A build at $0.20 and a repair at $0.20 both pass. A $0.26 build fails with `performance.budget` and its repair still passes. A $0.26 repair fails and its build still passes. Both settings payloads carry `{ maxEstimatedCostUsdPerRun: 0.25 }`. The run is 64 calls at $0.25.
    - `settleBuildOnce` now takes an optional budget.
    - Three `2` expectations are now `0.25`.
  - `live-llm/tests/budget.test.ts`: the pricey-run case is now 26 × $0.01 = $0.26 against the 0.25 limit.
  - `demo-llm-create-ui/tests/exploration.test.ts`: the proposal fixture cost is now $0.20 (it was $0.40). It asserts the limit is 0.25, that $0.26 fails, and a profile deepEqual now expects 0.25.
  - `src/tests/demo-llm-exploration-request.test.ts`: `providerBudget.maxTotalEstimatedCostUsd` is expected to be 0.25. This is the consumer test of `limits.ts`, and it is outside the owned list.

## Commands run and observed results

- **Before the change.** I copied `src` into `.t193-wG-src` and restored `live-llm-plan.ts`, `budget.ts` and `limits.ts` from `git show HEAD`, keeping the new tests. Command: `bash .../heavy.sh "t193-wG before-build" npx tsc -p tsconfig.t193-wG.json`, which printed tsc exit 0. Then `node --test` on the plan, budget, run, exploration and exploration-request tests printed `# tests 67, # pass 58, # fail 9`.
  - The new tests failed as expected: "64 calls at $0.25…" (35) and "each held to $0.25…" (56, which got `maxEstimatedCostUsdPerRun: 2` where 0.25 was expected).
  - The updated tests also failed, among them the budget.test cost case (21), which checks that $0.26 over 0.25 fails.
- **After the change.** `bash .../heavy.sh "t193-wG build" npx tsc -p tsconfig.t193-wG.json` (rootDir `src`, outDir `.t193-wG-after`) printed tsc exit 0. Then `node --test live-llm/tests/*.test.js demo-llm-create-ui/tests/*.test.js tests/demo-llm-exploration-request.test.js demo-workspace/adapting-run/tests/run-timeouts.test.js`.
  - The first pass printed 126/128. Two old expectations I had missed failed: exploration profile `1`, and plan `0.48`.
  - I fixed them and reran: `# tests 128, # pass 128, # fail 0, # cancelled 0`.
- **Cleanup.** The scratch dirs and tsconfig were deleted.
- **Structure audit.** `node scripts/structure-audit.mjs` printed `structure-audit: passed (125 warning(s), 120 baselined).`, exit 0.

## Not verified

- `dist/` was not rebuilt, and the brief's exact `pnpm --filter @fluxiq-web-extension/test-runner build` command was not run, for the reason given under Outcome. The supervisor should run it once the live run ends.
- In the per-phase test, the "over $0.25 fails" assertions come after the payload assertion. On the old source that test stopped at the payload assertion, so those later assertions were not run against the old source. The same breach was shown failing against the old source at unit level in budget.test (21).
- I did not run the whole test-runner suite; only the affected files listed above.
- I did not run a live or Lab run.
- I did not check Core's side, which another worker is changing.

## Open questions or contradictions found

- The brief asks for a `dist/` build while a live run is using `dist/`, and `clean-dist` deletes it. I compiled into a scratch outDir instead.
- `live-llm-run.test.ts` is now 446 lines. It was already 403 lines and over the 400-line advisory threshold before this change. The warning is advisory, not baselined, and does not fail the audit. Splitting the file was out of scope.
- The per-call cap `CORE_MAX_COST_USD` and the total `CORE_MAX_TOTAL_COST_USD` are both 0.25 but are separate ceilings. If Core exports its total ceiling after the other worker's change, the plan should import it rather than restate it.
