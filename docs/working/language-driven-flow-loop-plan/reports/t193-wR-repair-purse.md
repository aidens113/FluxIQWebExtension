# t193-wR: one purse per repair (Core)

Worker report. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ`. Nothing committed. Paths are relative to `packages/fluxiq/src/programs/automation-studio/runtime/` unless they start with `scripts/`.

## Outcome

Done. A refuted result's whole repair now spends from one purse. The purse is $0.25, lowered by the Flow's `maxEstimatedCostUsdPerRun` and never raised by it. It covers the re-author build, its retry, the patch-ladder fallback, and every later pass of the same run id.

Each part gets what is left, as its own total, after the parts before it have been charged what they reported. If there is not enough left for one more call at the repair's running average, the part doesn't run: it makes no model call, and the run records `llm_budget.run_cost_limit` / `bound: "cost"`. No grant and no ledger service were added. The purse is a few numbers kept on the run's own `resultReauthor` marker.

Through the real service, a Flow set to $0.10 whose repair never finishes now spends $0.09 across two passes. Before the change the same test spent $0.12.

## What changed and why

### 1. Every part one repair of one run can spend on

"Before" is the state after t193-wF. "Now" is after this change.

| Part | Where the call is made | Before | Now |
| --- | --- | --- | --- |
| The result check's judgement, and its ask-again | `result-verification/verify.ts:161` (harness call); `agreement.ts` (ask-again); provider from `run-outcome.ts:441` | Capped per call by the check's own authorization (`service/runtime-adaptation/result-check.ts`, `AUTOMATION_STUDIO_RESULT_CHECK_AUTHORIZATION_DEFAULTS`: $0.05 per call, $1 total), or by the caller's resolution | Unchanged. It is a separate check (see section 3). |
| Re-author build | `service/runtime-adaptation/refuted-result-port.ts:134` → `service.ts:1459` → loop limits `service.ts:1539` | $0.25 of its own (the loop budget, `llm/loop-budget.ts`) | Gets what the purse has left. `service.ts:1539` passes it as a lowering limit. |
| The build's instruction-authority call, inside the build | `service.ts:1540` | Counted in the build's accounting. The loop holds back one average decision for it. | Unchanged. It is charged as part of the build's reported cost. |
| Re-author retry after a retryable failure | `refuted-result-port.ts:167` | A fresh $0.25 | Gets what the first build left. It is refused on cost if that is not enough for one more call. |
| Patch-ladder fallback: diagnosis, exploration, patch reserve, replan, patch | `refuted-result-port.ts:174`, `191-192` → `service.ts:2592` → `recovery/annotation/annotate.ts:360` (diagnosis), `418` (exploration), `415` (reserve), `470` (replan), `561` (patch). The ledger is at `annotate.ts:329`. | A fresh $0.25 in its own ledger | The ledger total is what the purse has left (`annotate.ts:252-257` → `run-budget.ts`). With nothing left, `annotate.ts:147` makes no call. The spend is read back from `llmGate.costAccounting`. |
| Patch ladder for a refutation that is not routed (not a wrong answer, or no Flow) | `refuted-result-port.ts`, in the `!decision.route` branch | A fresh $0.25 | Same purse as the row above. |
| Unattended repair authority (a run nobody asked the model into) | `service/runtime-adaptation/repair-authority.ts:90` → `annotate.ts` | Min of the redemption and $0.25 | Also lowered by what the purse has left. With no caller, the re-author never reaches a model: `refuted-result-port.ts` throws `provider_resolution` before `deps.generate`. |
| Re-run of the same run id | `result-verification/run-outcome.ts:327-335`, repeating up to `AUTOMATION_STUDIO_RESULT_REPAIR_MAX_ATTEMPTS = 3` (`recovery/refuted-result/history.ts:40`) | Each pass started every part afresh. Three passes of three parts each could reach about $2.25. | Every pass opens the purse the last one saved on `resultReauthor.purse`. The re-run carries it forward (`repair-rerun.ts` carries metadata, and `recordOnRunDetail` re-reads it). The re-run of the graph makes no model call itself. |

### 2. The purse

**The new file is `recovery/refuted-result/purse.ts`.** It is exported through the directory barrel. It holds:
- the purse type (`limitUsd`, `spentUsd`, `unreportedParts`, `averagedCalls`, `averagedUsd`, `refusedParts`);
- `automationStudioResultRepairPurse(detail, flowMaxCostUsd)`, which opens the purse from the marker, with its limit taken from `automationStudioLlmRunCostCeilingUsd`;
- `...PurseLeftUsd`, `...PurseAllowsPart`, `...PurseCharged`, `...PurseRefused` and `...WithPurse`, which writes the purse onto the marker;
- `AUTOMATION_STUDIO_RESULT_REPAIR_COST_BOUND_CODE`, which is the ledger's own code `llm_budget.run_cost_limit` and is typed from `AutomationStudioLlmRunBudgetDiagnostic["code"]`.

Amounts are rounded to the billionth, as the ledger rounds them, so $0.25 minus $0.20 is exactly $0.05.

**"Nothing left" means not enough for one more call.** This goes a step beyond the brief. Within one part, spend is only held from reported costs after each call:
- the build loop always allows its first decision;
- the recovery ledger reserves `total / 24` for each call and then charges the call's actual cost.

So a part handed a sliver would still overspend by about one call. The first version of the port showed this. A later part therefore starts only when what is left covers one more call at the repair's average cost per call so far. That is the loop's own rule between decisions, applied between parts. The average uses only parts that reported a call count:
- a failed build's `evidenceLoop.decisionCount`;
- a recovery's `costAccounting.calls`.

The first part always starts, because there is nothing yet to average.

**The port (`service/runtime-adaptation/refuted-result-port.ts`):**
- It has a new dependency, `maxCostUsd()`, which returns the Flow's setting and is read lazily, the same way `flowId()` is.
- `deps.generate(request, brief, costLeftUsd)` and `deps.annotate(request, costLeftUsd)` are now handed what is left.
- A build is charged `(accounting ?? failure.accounting).estimatedCostUsd`.
- A build the purse can't cover is recorded as an attempt with `code: llm_budget.run_cost_limit`, `retryable: false` and `providerInvocation: not_attempted`.
- A patch ladder the purse can't cover is not called. It is recorded as `degraded: { to: "patch_ladder", afterCode, bound: "cost" }`.
- The purse is written onto the marker last. It has to be, because `automationStudioRefutedResultReauthored` rebuilds the marker.
- A recovery's spend is read only when that recovery replaced `llmGate`. An `llmGate` it didn't write is an earlier step's, for example the one the result check writes.

**Other files:**
- `recovery/refuted-result/reauthor.ts`: `automationStudioRefutedResultDegraded` now accepts `bound?: "cost"`.
- `recovery/annotation/run-budget.ts`: new input `costLeftUsd`, passed to `automationStudioLlmRunCostCeilingUsd` as one more lowering limit.
- `recovery/annotation/annotate.ts`: new input `costLeftUsd`. When it is 0 or less, the recovery returns before resolving any provider, with `llmGate { invoked: false, code: "llm_budget.run_cost_limit", bound: "cost" }` and a refused four-stage trace. This check is needed because the ceiling helper ignores a 0, which would otherwise quietly turn "nothing left" into the full $0.25.
- `service.ts`: six lines edited in place (91, 1459, 1539, 2591, 2592, 2593) and no lines added. It still has 4,479 lines.
  - The import adds `automationStudioLlmRunCostCeilingUsd`.
  - `generateFlowBootstrapAdaptationInternal` takes an optional third parameter, `repairCostLeftUsd`.
  - The build's loop limit is `automationStudioLlmRunCostCeilingUsd(flow setting, repairCostLeftUsd)`.
  - The port is handed `maxCostUsd: () => adaptationContext?.policy.maxEstimatedCostUsdPerRun`.
  - `annotate` and `generate` pass `costLeftUsd` through.
  - The public `generateFlowBootstrapAdaptation` passes nothing, so it is unchanged.

### 3. Is the result check's judgement part of "the repair"? No, it is a separate check

- **Purpose.** The code's own statement (`result-verification/run-outcome.ts`, header and lines 230-335) is that the check judges every finished run the schedule selects, whether or not any repair follows. A refutation is what starts a repair. The re-run's judgement is the same check, applied "exactly as this one was".
- **Its own permission and limit.** `result-check.ts` resolves the check through its own standing authorization, which is scheduled, redeemed per call, $0.05 per call and $1 in total. That authorization is also what pays for a check with no repair at all.
- **Consequence of folding it in.** Moving the judgement into the repair's purse would let a repair that spent its money silence the check. The check is what reports whether the repair worked, and a run that nobody checked must read as `unverified`, never `confirmed`.

So I left it alone. `purse.ts` states this, and the end-to-end test counts the judge's calls separately.

### 4. Tests

Each new test was run once against the previous sources and failed; the results are under "Commands run" below.

- **`service/runtime-adaptation/tests/refuted-result-port.test.ts`**, new `describe("the repair's one purse")` with eight tests:
  - a retry after a $0.20 build is handed $0.05 (`[0.25, 0.05]`);
  - re-authors that spent $0.15 + $0.10 leave the patch ladder uncalled, with `degraded.bound: "cost"` and `purse.refusedParts: ["patch_ladder"]`;
  - a first build that spent $0.25 gets no retry, and the refused attempt is recorded;
  - a Flow set to $0.10 hands out `[0.10, 0.03, 0.01]` across build, retry and ladder;
  - no later part starts when what is left can't cover one more call at the average;
  - a Flow set to $1 still gets $0.25;
  - a later pass opens the purse where the last one left it (`0.07` handed after `0.18` spent);
  - the not-routed ladder is handed $0.25, and is refused once the purse is spent.
- **`recovery/annotation/tests/annotate.test.ts`:**
  - `costLeftUsd: 0` asks no model, and names `llm_budget.run_cost_limit` / `bound: "cost"` with all four stages refused;
  - a control test: with $0.05 left, the model is still asked.
  - `annotate-harness.ts` gained a `costLeftUsd` option to support these.
- **`recovery/annotation/tests/run-budget.test.ts`:** `costLeftUsd` lowers the recovery total and never raises it.
- **New `tests/refuted-result/tests/repair-purse-chain.test.ts`.** It mirrors `repair-replay-chain.test.ts`. The run goes through the real service with a Flow set to $0.10, a judge that always refutes, and a model that never finishes a build, each call reporting $0.03.
  - Observed with a temporary print, since removed: pass 1's build spent $0.06 and applied. The re-run was refuted again. Pass 2's build was handed $0.04, spent $0.03 and ended `evidence_iteration_limit`. The retry and the ladder were then refused on cost.
  - The recorded purse was `{limitUsd 0.1, spentUsd 0.09, leftUsd 0.01, refusedParts [reauthor, patch_ladder], bound cost}`.

## Commands run and observed results

All commands were run from `packages/fluxiq`, except the structure audit.

- **Tests failing before the change.** I swapped in the previous sources (HEAD `refuted-result-port.ts` and `reauthor.ts`; wF's `run-budget.ts`, `annotate.ts` and `service.ts`, copied to scratchpad) and restored them afterwards. I confirmed the restore by grep and by rerunning the tests.
  - Unit tests: `npx vitest run .../refuted-result-port.test.ts .../annotate.test.ts .../run-budget.test.ts --minWorkers=1 --maxWorkers=2` gave "Tests 9 failed | 46 passed". Each failure was one of my new tests. For example: "expected [ undefined, undefined ] to deeply equal [ 0.25, 0.05 ]", "expected "spy" to be called 1 times, but got 2 times", "expected [ 'runtime_diagnosis', …(2) ] to deeply equal []", and "expected 0.25 to be 0.05". The running-average test was added after this run. Against the earlier source it could not pass either, because it asserts `purse` fields that did not exist.
  - End-to-end: `npx vitest run .../repair-purse-chain.test.ts` failed with "expected 0.12 to be less than or equal to 0.100000001".
- **Focused, after the change:** `npx vitest run` over the three unit files, `recovery/refuted-result/tests` and `tests/refuted-result/tests`, with `--minWorkers=1 --maxWorkers=2`. Result: "Test Files 11 passed (11), Tests 115 passed (115)". That includes `repair-replay-chain.test.ts` and `reauthor-service.test.ts`.
- **`heavy.sh "t193-wR tsc fluxiq" npx tsc --noEmit -p tsconfig.json`:** exit 0, no output.
- **`node scripts/structure-audit.mjs`** (Core root): "structure-audit: passed (195 warning(s), 354 baselined)". It also printed "1 baseline entries can be lowered", the same as wF's run. The only warnings on my files are advisories that already existed: `annotate.ts` is 714 lines, over the 400-line advisory and under the 800-line limit; the harness has 9 exported values.
- **`heavy.sh "t193-wR vitest repair dirs" npx vitest run runtime/recovery runtime/service/runtime-adaptation runtime/tests/refuted-result runtime/result-verification --minWorkers=1 --maxWorkers=2`:** exit 0, "Test Files 52 passed (52), Tests 655 passed (655)".
- **`heavy.sh "t193-wR build fluxiq" pnpm --filter fluxiq build`:** exit 0.
- **wF's own tests, after my change to the build's loop limit:** `npx vitest run tests/service-bootstrap/tests/cost-ceiling.test.ts llm/flow-execution-limits tests/recovery-default-limits.test.ts` gave "Test Files 4 passed (4), Tests 17 passed (17)".

## Not verified

- No Lab or browser run, as instructed. There is no live evidence that a real DeepSeek repair stops at the purse.
- **A failed build that reported no cost.** When a build fails at the `provider_request` stage, `flow-bootstrap/generation-failure/phase-failure.ts:39-40` drops its accounting on purpose. The same happens when the harness throws mid-loop and is wrapped at `service.ts:1523`. Either way the port can't read what that build had already spent. The purse counts it in `unreportedParts` and charges nothing. So a retryable provider timeout after $0.20 of decisions would give the retry a full remainder. Fixing this belongs in `flow-bootstrap/**`, which I must not touch.
- The instruction-authority call is made before the build loop and is bounded only by the loop's hold-back. A build's first part can therefore still overspend its own total by about one call. This is wF's existing behaviour within a single part; the purse closes the gap only between parts.
- I didn't run the wider `service-*` suites. They don't import the port or the purse.

## Open questions or contradictions found

1. **Unreported build spend** (see "Not verified"). Should a failed build that reached the provider and reported no cost be charged everything it was handed? That would be safe for the ceiling, but it would stop the retry from ever running after a timeout, which is the retry's main case. I followed the brief ("from their reported costs") and made the gap visible as `unreportedParts`. The better fix is for the build to attach the loop's accumulated accounting to a propagated decision error. That is flow-bootstrap's call.
2. **The running-average rule** goes beyond the brief. Without it, a remainder of $0.01 still buys a whole $0.03 call. The supervisor may prefer the literal rule ("nothing left" meaning $0). Removing it is two call sites in the port.
3. **A Flow set to $0** (wF's question 1) still gives a $0.25 purse, because the ceiling helper ignores 0. I didn't change that.
4. **The judgement is a separate check** (section 3). If the user means for "its repair" to include checking the re-run, the judgement would need its own purse input. `result-check.ts` is in my owned paths, but I didn't change it, because the code's purpose says the two are separate.
