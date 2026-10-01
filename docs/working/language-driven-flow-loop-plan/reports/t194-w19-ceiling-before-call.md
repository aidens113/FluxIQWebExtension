# t194-w19: the $0.25 build ceiling holds before a call is sent (Core)

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`, branch `task/t194-live-judge-answer`. Nothing committed, stashed or switched. No Lab runs.

## Outcome

Partial. The ceiling is now enforced before every build decision is sent, and an overspent call is counted as a breach. The second half of the brief is only partly done. The figures the build's closing message prints come from `flow-bootstrap/unfinished-build/{budget-exhausted,phases}.ts`, and those files are outside my edit list. The rest of this section says what I fixed and what still needs those files.

## The path a build decision takes, and why it was not held

1. `runtime/service.ts` (`generateFlowBootstrapAdaptationInternal`, around lines 1556-1604) runs each round through `runAutomationStudioLlmEvidenceLoop`. That loop's `decide` callback calls `runHarness` -> `runAutomationStudioLlmHarness` (`llm/harness/run.ts`). The callback passes **no `runBudget`, no `runId` and no `maxEstimatedCostUsd`**.
2. So `harness/run.ts` never reserved anything for a build decision. Its ledger reservation (`run-budget.ts:152-186`, priced by `reservedCostUsd`) runs only when `input.runBudget && input.runId` are set, which only recovery and result verification do. The `budgetBreaches` figure therefore never existed for a build. The Lab's `budgetBreaches: 0` is hard-coded in the extension's `packages/test-runner/src/live-llm/build-usage.ts:55`; Core never reported it.
3. The only cost check on a build was `llm/loop-budget.ts` (`automationStudioLlmEvidenceLoopRemaining`). It counts decisions left as `floor((ceiling - spent - one average decision held back) / averageCost)`, where the average is taken over the reported, cache-discounted decisions so far. On this run, after decision 8 that gave $0.1539 spent at a $0.0192 average, so it said 3 decisions were left. Decision 9 was then sent at 477,506 tokens, almost entirely uncached.
4. `loop-limits/flow-bootstrap-evidence-loop.ts` only computes the ceiling: $0.25, lowered by the Flow or resolver settings, or set to what is left for a repair. Each repair round gets what the earlier rounds left (`unfinished-build/phases.ts` `remaining`). `session-key-provider.ts` sets the per-call `maxEstimatedCostUsd` default to $0.25, which no build path read.

## What changed and why

- **New `llm/build-purse/`** (a barrel plus five files):
  - `projected-cost.ts`: a call's worst case, taken from the provider's own `estimateCostUsd`. For DeepSeek that is `estimateAutomationStudioDeepSeekCostUsd(input, output, 0 cached, model)`: every input token at the cache-miss rate plus the whole reply allowance at the output rate. `harness/run.ts`'s `reservedCostUsd` now uses the same function, so the ledger and the purse price a request the same way.
  - `purse.ts`: `AutomationStudioLlmBuildPurse` with these rules:
    - It refuses a call when `spent + pending + projected > ceiling`.
    - It holds `projected` while the call is in flight.
    - It charges the reported cost, or the held amount when nothing was reported.
    - A call it releases was never sent and is charged nothing.
    - A call that reports more than it was held at is counted as a breach.
    - "Spent" is the larger of the loop's accounting and the purse's own settled calls, so nothing is charged twice.
    - An unpriced provider is refused only once the purse is already spent. Holding such a call at the whole ceiling would refuse every call after the first.
  - `run.ts`: the purse is carried with the async call through `AsyncLocalStorage`, following the same pattern as `activity/storage.ts`. This lets the harness see the loop's purse **without editing `service.ts`**, which sits between them. `automationStudioLlmBuildPurseRun` throws `AutomationStudioLlmBuildPurseRefused` (`refused.ts`) whenever the purse refused during the call, whatever the caller then made of the failed result.
  - `harness-hold.ts`: the harness's side. It prices the measured request, holds it, or returns a `llm_budget.run_cost_limit` error diagnostic giving the spent amount, the amount in flight, the input and reply tokens, the projected cost and the ceiling.
- **`harness/run.ts`**: after the ledger reservation, it holds the request against the current purse, if there is one.
  - If the purse refuses, the ledger lease is released and the harness returns `providerInvocation: "not_attempted"`.
  - The hold is settled on every completion path: with the reported usage, with the reply usage on an unreadable reply, or released when the adapter refused before sending.
  - The estimate is the existing `measuredInput`: UTF-8 bytes / 3 of the serialized request, or of the provider's own `measureInput` (the messages DeepSeek will actually send), whichever is larger.
- **`evidence-loop/cost-purse.ts`** (new): the loop's purse. It exists only when the loop has `budget.maxCostUsd`, meaning a build or a repair round of one. It reads the loop accounting's spend and writes `accounting.budgetBreaches`.
- **`evidence-loop.ts`**: zero net lines. Another worker is editing this file at the same time, and our combined changes leave it at 799 of 800 lines.
  - Each `decide` runs under the purse.
  - A refusal ends the loop as `exhausted("budget")` with `budgetBound: "cost"` and `exhaustion.costRefusal` set to the refusal's figures.
  - **A budget ending no longer counts the decision it did not send.** `accounting.iterations` used to be set at the top of the iteration and kept when the budget stopped it before asking. That is why this run's message said "over 10 decisions" when 9 were sent. `phases.ts:223` reads `spent.iterations` as `decisions`.
- **`evidence-loop/accounting.ts`**: added optional `budgetBreaches`. It is absent when there are none, which keeps every existing deep-equality check unchanged.
- **`evidence-loop/exhaustion.ts`**: added optional `costRefusal`.
- **`loop-budget.ts`**: the spending input takes optional `nextDecisionCostUsd`, set to the purse's last projected worst case. Decisions left are counted at the larger of that and the average. The model is now told it is wrapping up, or the loop stops at the top of an iteration, before the purse has to refuse a call. On this run's figures that is 0 decisions left after decision 8, where the old count said 3.

## Estimate against the provider's count on this run

The decision dump (`test-runs/instances/t194-slot-3/decision-dumps/build-...-31824.jsonl`) does not keep the request, so I could only bound the estimate from below. The 11 evidence entries shown to decision 9 alone serialize to 1,361,546 bytes, which is 453,849 estimated tokens. That is 95.0% of the provider's 477,506, before adding the system prompt, catalog, schema, draft and history that the full request also carries. Since the estimate counts the whole request, I expect it to be close to or above the provider's count. Even this lower bound projects 453,849 x $0.30/M + 8,000 x $1.20/M = $0.1458, and with $0.1539 already spent the total is $0.2997, over $0.25. So decision 9 is refused even on the evidence alone. At the provider's own count the projection is $0.1529 (unit test `purse.test.ts`, first case).

## Commands run and observed results

- `npx vitest run .../llm/build-purse .../llm/tests/evidence-loop-cost-purse.test.ts .../llm/tests/loop-budget.test.ts`: the new integration test's first version failed 3/3 with "requires the domain's declared deniedEvidenceKeys". That was a fault in the test fixture, not in the fix. Declaring `deniedEvidenceKeys: []` fixed it, and it then passed 3/3. `purse.test.ts` passed 7/7 and `loop-budget.test.ts` 11/11.
- **Fails before the fix:** I temporarily replaced the purse lookup in `build-purse/harness-hold.ts` with `undefined`, then restored the file from a scratch copy and confirmed it with grep.
  - `npx vitest run .../evidence-loop-cost-purse.test.ts` printed `× does not send a decision whose worst case would cross the ceiling ... → expected 2 to be 1` and `× counts a decision that reported costing more than its worst case as a breach`, `Tests 2 failed | 1 passed (3)`.
  - With the fix the same tests printed `3 passed`. After moving the file to `evidence-loop/tests/cost-purse.test.ts`: `build-purse/tests/purse.test.ts (7 tests)`, `evidence-loop/tests/cost-purse.test.ts (3 tests)`, `Test Files 2 passed (2) / Tests 10 passed (10)`.
  - `loop-budget.test.ts`: `11 tests` passed, including the new case from this run: 3 decisions left at the average, 0 at the last projected cost.
- `bash heavy.sh "t194-w19 tsc" npx tsc --noEmit -p packages/fluxiq/tsconfig.json`: exit 0. That run started before the last edits; the final rerun is reported below.
- `bash heavy.sh "t194-w19 vitest" npx vitest run $R/llm $R/loop-limits $R/flow-bootstrap $R/tests/refuted-result $R/recovery` (from `packages/fluxiq`): `Test Files 1 failed | 182 passed (183)`, `Tests 2165 passed (2165)`. The one failed file was my integration test, which I moved to `evidence-loop/tests/` while the run was collecting, so vitest could not find it at the old path. No test failed. The final rerun is reported below.
- `node scripts/structure-audit.mjs`: `2 violation(s) across 2 rule(s)`, neither of them mine:
  - `llm/tests/: 26 source files exceeds the 25-file limit`: 25 tracked files plus another worker's untracked `llm/tests/evidence-loop-decision.test.ts`. I moved my own test out of that folder for this reason.
  - `runtime/service.ts: 4506 lines ... Baseline ... 4505`: another worker's edit. I do not touch `service.ts`.
  - My earlier `imports` violations (reaching into `../harness/*.ts`) are fixed by importing from `../harness/index.ts`.
- **Final rerun, after every edit:**
  - `bash heavy.sh "t194-w19 tsc" npx tsc --noEmit -p packages/fluxiq/tsconfig.json`: `exit 0`, no output.
  - `bash heavy.sh "t194-w19 vitest" npx vitest run $R/llm $R/loop-limits $R/flow-bootstrap $R/tests/refuted-result $R/recovery`: `Test Files 182 passed (182)`, `Tests 2168 passed (2168)`, `exit 0`.

## Not verified

- No live run (forbidden). Whether the estimate lands above or below DeepSeek's count on a real decision-9 request is bounded, not measured (see the estimate section).
- Calls outside a loop's `decide` are not held by the purse:
  - the instruction authority's calls (`service/instruction-authority.ts`, run from `executeTool` and the permission gate);
  - the one-shot (non-evidence-guided) build;
  - the build's plan check.
  The loop-budget's held-back average decision still covers the authority's calls, as before.
- The `budgetBreaches` count reaches the loop result only. `phases.ts` `addAccounting` does not sum it across rounds, `sanitizedBootstrapAccounting` in `service/flow-bootstrap-commands/` does not carry it, and the Lab hard-codes 0. None of those files is in my list.

## Open questions and what needs files outside my list

1. **The closing message's figures** (`flow-bootstrap/unfinished-build/budget-exhausted.ts`, `phases.ts`).
   - With the fix, "stopped at its spending limit of $0.25" is no longer false, because spend can no longer pass the ceiling.
   - The decision count is now right for a budget ending (9, not 10), fixed in the loop.
   - What the message still cannot say is what was spent and what the next call would have cost. That needs `budget-exhausted.ts` `budgetSaid`/message to read `exhaustion.costRefusal`, for example "$0.15 of its $0.25 spending limit was spent and the next decision could have cost up to $0.15". It also needs `phases.ts` to carry `costRefusal` and the build's spent total into `told`/`sizes`.
   - Carrying it on the failure diagnostic would also need `generation-failure/{evidence-failure,diagnostic,diagnostic-parse}.ts`. I left that out because the extension parses those fields exactly, so it is a cross-repository contract change for the supervisor to decide.
2. **Making breaches visible for a build** needs three edits: `phases.ts` `addAccounting` to sum `budgetBreaches`, `service/flow-bootstrap-commands` to keep it, and the extension's `build-usage.ts` to stop hard-coding 0.
3. `evidence-loop.ts` is at 799 of 800 lines with another worker's tool-failure edits in it. The next change to that file needs a split first.

Compatibility impact for downstream:
- No wire field changed. `accounting.budgetBreaches` and `exhaustion.costRefusal` are optional, Core-internal, and not carried into the build-failure diagnostic.
- A refused decision ends the build as the existing `flow_bootstrap.evidence_budget_exhausted` with `bound: "cost"`, earlier than before.
- Builds now stop sooner on large-context models, where they previously overspent.
- The harness diagnostic code for a refused build decision is the existing `llm_budget.run_cost_limit`.
