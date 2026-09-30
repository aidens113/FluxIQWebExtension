# t193-wF: the $0.25 run cost ceiling (Core)

Worker report. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ`. Nothing committed. Paths below are relative to `packages/fluxiq/src/programs/automation-studio/` unless they start with `apps/`.

## Outcome

Done. Builds, re-author builds and recoveries now all default to a total of $0.25, taken from one named constant. A Flow's setting can lower that total but can't raise it, and there are no grants. A build that never finishes now stops once it runs out of money, with the bound reported as `cost`. In the scripted test it made 7 provider calls and spent $0.21.

## What changed and why

1. **The constant.** New file `runtime/llm/flow-execution-limits/run-cost-ceiling.ts` holds `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD = 0.25` and `automationStudioLlmRunCostCeilingUsd(...limits)`. The function returns the lowest of the ceiling and every limit passed in that is a positive finite number; anything else is ignored. It is exported through the directory barrel and so reaches `runtime/llm/index.ts`.
   - `runtime/llm/session-key-provider.ts`: the resolver's `maxTotalEstimatedCostUsd` was $2 and is now the constant. Its per-call `maxEstimatedCostUsd` was already 0.25 and now names the constant too.
   - `runtime/llm/run-budget.ts`: the ledger's `?? 0.25` defaults, for both the run total and a reservation, now name the constant. A local `requestedCost` removes the repeated expression. Behaviour is unchanged.
2. **The build total.** In `runtime/loop-limits/flow-bootstrap-evidence-loop.ts` the build's `maxCostUsd` used to be the Flow's setting, or else the resolver's total, and the Flow's figure won even when it was higher. It is now `automationStudioLlmRunCostCeilingUsd(resolution.maxTotalEstimatedCostUsd, flowSetting)`, and every build budget carries it, even one whose resolution names no total.
   - **Does `llm/loop-budget.ts` already stop the build? Yes. No change was needed there.** Before each decision, `evidence-loop.ts:520-527` calls `automationStudioLlmEvidenceLoopRemaining`. For cost, that function computes `costLeft = max - spent - (unreported + 1) * averageCost` and returns 0 decisions when `costLeft` doesn't cover one more decision at the running average. The first decision is always allowed, because with nothing to average it returns `iterationsLeft`. At 0 the loop returns `exhausted("budget")` and records `budgetBound: limitedBy`, which is `"cost"` when cost is the tightest bound.
   - This rule is stricter than the brief's: it also holds back one average decision for calls the loop can't see, such as the instruction-authority call.
   - The wrap-up (three decisions left, then one) is a way of finishing, not the stop. The stop is the 0 check. The scripted test confirms both.
3. **The per-call caps.**
   - Removed the build's derived share (the type field `maxEstimatedCostUsdPerCall` and its computation). It was total divided by iterations, and a build passes no `runBudget`, so the harness only range-checked it (`harness/run.ts:97`, `deepseek/preflight.ts:34`). Nothing enforced it.
   - `runtime/service.ts` changed by removal only; nothing was added. Line 1540 no longer passes it to the instruction authority, and the former line 1590 was deleted. The file went from 4,480 to 4,479 lines.
   - The unused `maxEstimatedCostUsd` input field of the loop-limits function was removed.
   - Build requests now carry the harness's own default, `AUTOMATION_STUDIO_LLM_DEFAULT_MAX_ESTIMATED_COST_USD = 0.25` (in `harness/token-limits.ts`, which I didn't change).
4. **Repair paths.**
   - **The run's recovery** (`recovery/annotation/run-budget.ts`, called from `annotate.ts:230`). Both the "person asked" and "nobody asked" branches now use `automationStudioLlmRunCostCeilingUsd(requestedCost, policyMaxEstimatedCostUsdPerRun)`.
     - Before, a run a person asked for took the Flow's setting, or else the resolver's $2, capped at $2.
     - I removed `AUTOMATION_STUDIO_RECOVERY_MAX_ESTIMATED_COST_USD_PER_RUN = 2`, which the new ceiling replaces. Nothing downstream imports it (I grepped the extension worktree), and the two tests that pinned it were updated.
     - Each call's reservation is still `total / shares` and is now derived from $0.25 (0.25 / 24 by default).
   - **The result check's re-author build** (`service/runtime-adaptation/refuted-result-port.ts` calls `deps.generate` in extend mode with a repair brief). It runs the same `generateFlowBootstrapAdaptationInternal` and `automationStudioFlowBootstrapEvidenceLoopLimits(unresolvedProvider, Flow policy)`, so it gets $0.25 and respects a lower Flow setting. I checked `recovery/refuted-result/{reauthor,repair}.ts` and they set no cost of their own. No change.
   - **The unattended repair authority** (`service/runtime-adaptation/repair-authority.ts:90`). It hands `maxTotalEstimatedCostUsd = min(host per-call, redemption)` to the recovery, whose budget now caps that at $0.25 and at the Flow's setting. No change.
   - **Also checked, left alone:** `service/runtime-adaptation/result-check.ts:176`, which caps the result check's own verification call (not a repair), and `result-check-authorization/repair.ts:112`, whose redemption ceiling now only lowers.
5. **Defaults.**
   - `model/flows.ts` (`defaultAutomationStudioFlowSettingsMetadata`) is now `maxEstimatedCostUsdPerRun: 0.25`. It is written as a literal because `model/` doesn't import the runtime; a test holds it equal to the constant.
   - The web app's `FLOW_ADAPTATION_POLICY_DEFAULTS.maxEstimatedCostUsdPerRun` (`apps/web/.../settings/flow-settings-model.ts`) is now 0.25.
   - The form accepts it: `flowLimitsInterfaceErrors` allows 0 to 100,000, and the input is `min=0 step=0.01`. The new web test checks this.
6. **Tests.**
   - New: `runtime/llm/flow-execution-limits/tests/run-cost-ceiling.test.ts` and `runtime/tests/service-bootstrap/tests/cost-ceiling.test.ts`. The second is a scripted provider on the host resolver's defaults, reporting $0.03 per call.
   - Added cases in `loop-limits/tests/flow-bootstrap-evidence-loop.test.ts`, `recovery/annotation/tests/run-budget.test.ts` and the web `settings-round-trip.test.tsx`.
   - Tests that pinned the old $2, $1 or per-call share were updated. Beyond the files beside the owned code, these were outside it: `runtime/tests/recovery-default-limits.test.ts`, `runtime/tests/service-bootstrap/tests/generation.test.ts`, `runtime/tests/service-flows/tests/creation.test.ts`, `recovery/annotation/tests/iteration-guards.test.ts`, `llm/tests/session-key-provider.test.ts` and `llm/flow-execution-limits/tests/resolution-within-flow-settings.test.ts`.

**Per-call caps that remain, and what enforces each:**
- **Recovery reservation share** (`recovery/annotation/run-budget.ts`, `maxEstimatedCostUsdPerCall = total / shares`). Enforced by `AutomationStudioLlmRunBudgetLedger.reserve` (`llm/run-budget.ts`) for the diagnosis, the exploration, the patch reserve and the patch (`annotate.ts` lines 356, 392, 419, 473, 536). This is the only per-call cap a ledger enforces.
- **Ledger default reservation** when a caller gives none: the whole $0.25 (`llm/run-budget.ts`). Enforced by the same ledger.
- **Harness request `maxEstimatedCostUsd`** (default 0.25). Only range-checked (at most 10) in `harness/run.ts:97` and `deepseek/preflight.ts:34`. It reaches a ledger only when a `runBudget` is passed, and builds pass none.
- **The resolver's per-call `maxEstimatedCostUsd`** (now the constant), narrowed by the Flow's `llmExecutionSettings.maxEstimatedCostUsd` (at most 0.25, `flow-execution-limits/resolution-within-flow-settings.ts`). Used by:
  - the non-evidence build request at `service.ts:1619`, which is not enforced;
  - the recovery's purse fallback, only when a resolver gives no total.
- **The result check's verification-call cap** (`result-check.ts:176`). Set by the standing authorization; not part of this brief.

## Commands run and observed results

- **Tests before the change**, each run once and failing:
  - loop-limits: `npx vitest run .../runtime/loop-limits` gave "3 failed | 15 passed". The failures were default 0.25 (received 2), Flow $1 (received 1), and no per-call share (received 0.015625). The $0.10 case already passed before the change, as expected.
  - recovery: `npx vitest run .../recovery/annotation/tests/run-budget.test.ts` gave "2 failed | 11 passed".
  - scripted build: `npx vitest run .../service-bootstrap/tests/cost-ceiling.test.ts` failed with "expected 0.96 to be less than or equal to 0.25"; the build ran to the Flow's $1.
  - web: `npx vitest run src/features/automation-studio/settings/tests/settings-round-trip.test.tsx` gave "2 failed | 13 passed" ("expected '1' to be '0.25'").
- **Focused tests after the change** (8 files: loop-limits, recovery run-budget, flow-execution-limits, session-key-provider, llm run-budget, recovery-default-limits, cost-ceiling): "Test Files 8 passed (8), Tests 61 passed (61)".
  - The scripted build, from a one-off print that was removed afterwards: 7 requests, spent $0.21, `exhausted: {bound: "budget", iterations: 8, budgetBound: "cost"}`, accounting `estimatedCostUsd: 0.21`.
- **`heavy.sh "t193-wF vitest runtime final"`** (`vitest run` over runtime/llm, runtime/loop-limits, runtime/recovery, runtime/tests/service-bootstrap, recovery-default-limits and creation): "Test Files 6 failed | 120 passed (126)", 17 failed tests.
  - Six are t174's known failures in `rejections.test.ts` ("expected { …(6) } to deeply equal { …(5) }").
  - Eleven were "Test timed out in 15000ms" and one was EBUSY, while three other lanes held build slots.
  - Rerun one at a time (`heavy.sh "t193-wF vitest bootstrap rerun"`, accounting, adaptation, catalog, permission, plan-parameters and rejections, `--maxWorkers=1 --testTimeout=90000`): "Test Files 1 failed | 5 passed (6), Tests 6 failed | 55 passed". Only t174's six remain.
  - An earlier full run of the same set, before the generation and iteration-guards test updates, gave "9 failed | 1246 passed (1255)": t174's six plus the three tests I then updated, which pass on their own ("2 passed (2), 16 passed").
- **`heavy.sh "t193-wF vitest defaults"`** (runtime/service, service-flows, service-adaptation, result-check-authorization, model, api): 31 failed.
  - All were 15 s timeouts except one real failure: `creation.test.ts` still expected `maxEstimatedCostUsdPerRun: 1`, and I updated it.
  - Rerunning all 18 failed files one at a time (`--maxWorkers=1 --testTimeout=60000`): "Test Files 18 passed (18), Tests 64 passed (64)".
- **Web settings tests** (`apps/web`, `npx vitest run src/features/automation-studio/settings`): "Test Files 9 passed (9), Tests 60 passed (60)".
- **Type checks:** `heavy.sh "t193-wF tsc fluxiq" npx tsc --noEmit` (packages/fluxiq) exited 0 with no output. `heavy.sh "t193-wF tsc web" npx tsc --noEmit` (apps/web) exited 0 with no output.
- **Structure audit:** `node scripts/structure-audit.mjs` (Core root) printed "passed (195 warning(s), 354 baselined)" and "1 baseline entries can be lowered". That entry is presumably `service.ts`, now one line shorter. I didn't run `pnpm structure:baseline` because `.structure-baseline.json` isn't mine to edit.
- **Build:** `heavy.sh "t193-wF build fluxiq" pnpm --filter fluxiq build` exited 0.

## Not verified

- No Lab or browser run, as instructed. There is no live evidence that a real DeepSeek build stops at $0.25.
- The full service-adaptation and service-flows suites never passed in one concurrent run, only file by file. Their failures under load were timeouts or EBUSY, never an assertion, apart from the `creation.test.ts` expectation I fixed.
- I didn't check the downstream extension or Lab defaults; another worker owns them.

## Open questions or contradictions found

1. **A Flow set to $0.** The helper ignores a stored 0, as the build always did, so a Flow saved with 0 gets $0.25. In a recovery nobody asked for, a policy of 0 used to give a $0 purse, which would have made the ledger constructor throw. If $0 should mean "spend nothing", the build and the recovery need a deliberate refusal path. The web form accepts 0.
2. **One repair can spend more than $0.25 in total.** `refuted-result-port.ts` retries a retryable failed re-author build once (up to $0.25 each), then falls back to the patch ladder, which is another recovery of up to $0.25. Each part is capped, but the repair as a whole can reach about $0.75. A single purse for the whole repair would mean threading spend through `deps.generate`.
3. **A provider that reports no cost defeats the build's cost bound.** If a provider never reports `usage.estimatedCostUsd`, or always reports 0, the average cost stays 0 and cost never binds. Tokens, the deadline and the call backstop still bind.
4. **`FLOW_MAX_COST_USD = 0.25`** in `resolution-within-flow-settings.ts` mirrors the API's per-call settings bound (`api/handlers/llm-execution-settings.ts`). It is a separate literal with the same value, and I left it alone.
5. The supervisor may want to run `pnpm structure:baseline` to record the one lowerable baseline entry.
