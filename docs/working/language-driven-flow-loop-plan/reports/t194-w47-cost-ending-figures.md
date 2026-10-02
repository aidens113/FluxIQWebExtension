# t194-w47: why run 13's cost ending had no figures

Core worktree `fxwork/t194/!FluxIQ`, branch `task/t194-live-judge-answer`. Paths below are relative to
`packages/fluxiq/src/programs/automation-studio/runtime/`. Nothing was committed.

## Outcome

Done. **The loop's own cost count ended the build, not the purse.** `llm/loop-budget.ts`, called at the top of each
iteration (`llm/evidence-loop.ts:492-499`), returned `decisionsLeft: 0` with `limitedBy: "cost"`. The 16th decision was
never sent, so the purse never priced or refused it. `purse.refusal` was therefore `undefined` when `exhausted("budget")`
built the record. `llm/evidence-loop/exhaustion.ts` set `budgetBound: "cost"` from `lastRemaining.limitedBy` but attached
no `costRefusal`. `unfinished-build/phases.ts` (`purseSpending`) then returned `undefined`, and
`unfinished-build/budget-exhausted.ts` said no figure.

The chat capability (`flow.createHere`) is not at fault: it passes on the `budget_exhausted` message unchanged. The
phase `remaining()` budget did not end the build either: the build had one round, and `exhaustedBound` was never reached.

Every cost ending now states what was spent. Where a decision was declined, it also states what that decision could have
cost. This is information only: no refusal, gate or threshold changed.

### Run 13's figures at the stop (from `steps/*-decide/meta.json`)

- **Spent:** 15 decisions cost $0.073761. Each one reported its usage, the malformed 0023 included. The ledger's $0.0738
  also counts the $0.000312 chat intent call.
- **Average decision:** $0.004917, which the count holds back as one unreported decision.
- **Cost left as the count saw it:** 0.10 − 0.073761 − 0.004917 = **$0.0213**. Before the holdback it was $0.0262.
- **Reserve for the next decision:** `max(average, purse.lastProjectedCostUsd)`. The last projection was 0032's worst
  case: 72,677 × $0.30/M + 8,000 × $1.20/M = **$0.0314**.
- **Result:** $0.0213 is less than $0.0314, so `decisionsLeft` was 0 and `exhausted("budget")` ran. The step log ends at
  0032, and no 0033 exists.
- **A correction to the debug note:** the decision dump's last budget entry (iteration 15) shows `costLeftUsd: 0.0371`
  and the wrap-up instruction. That matches 0.10 − 0.05868 − 0.004191. Cause 5 in
  `debugs/run-muqbzu32-8691a65e.md` says "the purse refused a decision with $0.026 of the $0.10 left". It was the loop's
  count, against $0.0213 after the holdback.

## What changed and why

- **`llm/build-purse/purse.ts`**
  - `AutomationStudioLlmBuildPurseRefusal` gains an optional `declinedBy?: "loop_budget"`. It is absent on the purse's
    own refusal.
  - The purse now records the tokens of the last call it priced.
  - New `standing()` method returns the purse's figures in a refusal's shape: spent, pending, ceiling, and the last
    priced call's worst case and tokens. The tokens are 0 when nothing was priced. It holds and refuses nothing.
- **`llm/evidence-loop/cost-purse.ts`**
  - The loop's `refusal` getter returns `purse.refusal ?? purse.standing()`, or `undefined` when the loop has no cost
    budget.
  - This was the only channel available. `evidence-loop.ts` passes `purseRefusal: purse.refusal` to the exhaustion, and
    I may not edit that file.
- **`llm/evidence-loop/exhaustion.ts`**
  - The purse's real refusal still wins and still names `cost`.
  - A `loop_budget` standing becomes `costRefusal` only when `bound === "budget"` and `lastRemaining.limitedBy` is
    `"cost"`.
  - A tokens or duration stop keeps its own bound and gets no cost figures.
- **`unfinished-build/phases.ts`**
  - `purseSpending` is replaced by `costSpending`, which always returns figures for a `cost` ending.
  - With a `costRefusal`, it returns the build's spend: rounds before plus this round, the pending amount, the projected
    cost, and `projectedAtLeast` for a `loop_budget` standing.
  - Without one, as when a repair has nothing left to start with, it returns the whole build's
    `spent.estimatedCostUsd`.
- **`unfinished-build/budget-exhausted.ts`** (`spendingSaid`) now produces one of four endings:
  - Purse refusal: "and its next call could have cost up to $Y" (unchanged).
  - Loop-count stop: "and its next call could have cost $Y or more". The figure is the last request's worst case, and
    the next, larger request costs at least that at worst.
  - No projection and money left: "which left $Z, too little for its next call".
  - No projection and nothing left: "which left nothing for its next call".
- **Tests**
  - New: `unfinished-build/tests/loop-budget-cost-ending.test.ts`. It drives the real loop through the real harness
    with run 13's 15 per-decision input tokens and costs, priced like DeepSeek flash, under a $0.10 ceiling, through
    `runAutomationStudioFlowBootstrapBuildPhases`.
  - Updated, because they encoded the defect: `budget-figures.test.ts` (the "is unchanged where the loop's own
    arithmetic stopped it" case) and two `phases.test.ts` message regexes. Those now expect "it had spent $0.250, which
    left nothing for its next call".
  - Added cases to `budget-figures.test.ts`, `build-purse/tests/purse.test.ts`, `evidence-loop/tests/exhaustion.test.ts`
    and `evidence-loop/tests/cost-purse.test.ts`. The last checks that a real refusal carries no `declinedBy`.

**Run 13's ending now:** "The build stopped at its spending limit of $0.10 before the Flow was finished: it had spent
$0.074, and its next call could have cost $0.031 or more. ..."

## Commands run and observed results

- **New test on the old source** (before any source edit):
  - First run: failed on `iterations: 7` against 15. The tool results were identical, so a round ended early. I made
    each look distinct.
  - Second run: one round, `{"bound":"budget","iterations":15,"budgetBound":"cost"}`, no `costRefusal`. The message
    was "The build stopped at its spending limit of $0.10 before the Flow was finished. No step I found belonged in the
    Flow. I explored live once over 15 decisions. Nothing was kept to carry on from." That is run 13's ending without
    figures. The test failed, as intended.
- **Changed directories:** `npx vitest run .../flow-bootstrap/unfinished-build .../llm/build-purse .../llm/evidence-loop`
  - First run after the fix: 2 failed. Both were `phases.test.ts` regexes asserting the old figure-less message, which I
    updated.
  - Final run: **32 files, 196 tests passed**.
- **Service cost-ceiling test:** `npx vitest run .../runtime/tests/service-bootstrap/tests/cost-ceiling.test.ts`: 1 passed.
- **`bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w47 core check" pnpm check`** (in `packages/fluxiq`): tsc
  completed with no errors. A rerun printed `exit=0`.
- **`node scripts/structure-audit.mjs`** (Core root): "structure-audit: passed (211 warning(s), 349 baselined)", exit 0.
  It also said "1 baseline entries can be lowered". I did not touch the baseline.

## Proposal (not applied): price a decision at the previous call's cached share and twice the largest reply so far

**Formula:**

    input × (1 − prevShare) × $0.30/M + input × prevShare × $0.006/M + 2 × maxReplySoFar × $1.20/M

The first call has no history, so it uses the 8,000-token allowance and no cache. `input` is the call's reported input,
standing in for the harness's measure.

| Step | Input | Previous cached share | Reply allowance | Old worst case | Proposed | Actual | Spent before |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0003 | 16,251 | 0% | 8,000 | $0.0145 | $0.0145 | $0.0048 | $0.0000 |
| 0005 | 19,376 | 3.9% | 194 | $0.0154 | $0.0058 | $0.0023 | $0.0048 |
| 0013 | 20,732 | 68.1% | 214 | $0.0158 | $0.0023 | $0.0026 (over) | $0.0140 |
| 0021 | 27,833 | 63.0% | 214 | $0.0179 | $0.0034 | $0.0044 (over) | $0.0243 |
| 0026 | 41,355 | 67.7% | 800 | $0.0220 | $0.0051 | $0.0089 (over) | $0.0362 |
| 0029 | 58,368 | 33.1% | 938 | $0.0271 | $0.0130 | $0.0135 (over) | $0.0452 |
| 0032 | 72,677 | 26.8% | 946 | $0.0314 | $0.0172 | $0.0151 | $0.0587 |

The other eight calls were all within their projection. Script output covered all 15 calls.

- **What it would have allowed.** All 15 calls are sendable under either pricing. At the 16th:
  - The loop's reserve would have been 0032's proposed $0.0172 instead of $0.0314.
  - $0.0213 ≥ $0.0172 gives `decisionsLeft = 1`. That is a final decision offering completion only. It is not more
    exploration.
  - The 16th request was probably about 88-95k tokens, judging by the growth per rerun of +14-17k. Its proposed price
    would be $0.0188-$0.0201 against $0.0262 left, so the purse would send it.
  - After it, about $0.007 is left, less than an average decision, so the build ends there.
- **Would it ever cross $0.10?** In the observed sequence, no: everything sent totals $0.0738.
  - It can cross on the 16th call if that call's cache share collapses. With 34% cached as on 0032, it costs about
    $0.019 (total about $0.093). With nothing cached, an 88k-token call costs $0.0270, for a total of **$0.1008**,
    over by $0.0008. A 95k-token call costs $0.0291, for a total of $0.1029.
  - The proposal underestimated **4 of 15 calls**. Each one dropped its cached share after the call before it, and the
    largest miss was 0026: $0.0089 against $0.0051. The breach counter would record each one.
  - The proposal is no longer a worst case. It trades the guarantee for about one extra decision in this run. A
    variant that keeps the ceiling safe would hold a cushion, priced at the uncached rate, for the cached share. On
    0032 that is about $0.0058.

## Not verified

- No live run and no Lab run, as the brief said. No downstream code was run.
- The harness's own input measure for run 13's requests is not in the step log, so I used the provider-reported input
  tokens. Run 13's real reserve may differ slightly from $0.0314. The arithmetic gives $0.0213 < $0.0314 with room to
  spare.
- The size of the hypothetical 16th request is an estimate.
- No full suites were run, by the twice-a-day rule. Only the changed directories and the service cost-ceiling test ran.

## Open questions or contradictions found

- **The cleaner fix is outside my brief.** Passing the loop's reserve directly would mean adding it to
  `AutomationStudioLlmEvidenceLoopRemaining` in `llm/loop-budget.ts` (not owned) or passing it at the `exhausted()` call
  in `evidence-loop.ts` (must not touch). I routed it through the cost purse's `refusal` getter instead, so that getter
  now also returns the purse's standing when the purse refused nothing. `exhaustion.ts` is its only reader and filters
  by bound.
- **Two figures disagree.** The figure the person sees is the last request's worst case, `lastProjectedCostUsd`. The
  loop's reserve is `max(average, lastProjected)`, so when the average is larger the stated figure is the smaller of
  the two. It is still accurate as "or more".
- **The debug note's cause 5 should say "the loop's cost count"**, not the purse, and "$0.0213 after holding back one
  average decision" ($0.0262 before the holdback).
- **Step 0032's own rerun never ran.** It was an amend_draft with a rerun, and nothing follows 0032 in the step log.
  The budget check at the top of iteration 16 ran first. I did not trace whether that ordering is intended.
