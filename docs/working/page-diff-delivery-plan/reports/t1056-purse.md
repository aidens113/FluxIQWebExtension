# t1056-purse report: judging at the reserve, priced holds, re-pinned budgets

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t1056/!FluxIQ` (branch at 70709836d when this report was written; the lead
committed part of this work in progress as 70709836d). Paths below are under `packages/fluxiq/src/`.

## Outcome

**Partial.** Items 1, 3 and 4 are done. Item 2 is done for 11 of the 15 listed tests; the other 7 failures (plan-parameters
x4, unreadable-replies, llm-run-caller x2) are caused outside my paths and are reported below with file and line, not
fixed. One product defect was found and fixed in the purse: an unpriced provider's calls were held below what they
cost, so every call overshot its hold and the overshoot, not the judge, spent what was kept back for judging.

## What changed and why

### The defect: priced holds starved the final judged run (fixed, `runtime/llm/build-purse/`)

Round 2's `priced.ts` priced every call of a provider with no `estimateCostUsd` at Core's default model's rates
(deepseek-flash, about $0.0003 per 1,000 input tokens). That replaced the purse's own rule for an unpriced call -- hold it
at the most any call on the purse has reported costing (`agents/budget/purse.ts`, `settlement-ledger.ts`
`largestReportedUsd`) -- with a guess that is far too low for any provider dearer than the default. Traced on
creation-spend (e): the judge's calls reported $0.10 each against holds of about $0.002; the third judge call was admitted
at $0.2075 spent and settled at $0.3075 of a $0.25 ceiling. Every call was a breach, and nothing was left for judging.

Fix:
- New `runtime/llm/build-purse/observed-cost.ts`: per purse (WeakMap over the build purse, the Flow purse and the purses
  they were carved from), the most any settled call reported costing, and apart from it the most a judge's call reported.
- `priced.ts`: an unpriced call is priced at max(default model's price, observed). The provider's own price, where it
  gives one, is unchanged.
- `harness-hold.ts`: a judge's call (and the judging pair kept back, through `judgePricing`, now always handed over) is
  priced against the most a judge's call reported, as the purse holds judging at the largest judge call priced
  (`agents/budget/judging-reserve.ts`); any other call against the most any call reported. Each settled call's reported
  cost is noted.
- New test `runtime/llm/build-purse/tests/priced.test.ts` (3 cases): default pricing and the provider's own price; after a
  call reports more, the next is held at that and the one that would cross is refused unsent (one breach, not one per
  call); a judge's call held at what a judge cost and the pair kept back at that, so a decision that would eat into it is
  refused while the pair still fits.

This fixed, with no test change: creation-spend (e) (2 judge calls again: J2 is held at $0.10, J3 is refused) and
`refuted-result/tests/flow-purse-chain.test.ts` (0.06 > 0.05 is gone).

### 1. Judging at the reserve

- **judged-build "preflights a ready draft at the call reserve"**: cause was the fixture, not the purse. Round 2 had the
  decisions report $0.05 while the scripted provider priced them at 1e-6 per token (about $0.025 for a 24k-token
  request), so every decision overshot by half, the fifth settled at $0.2533 of $0.25, and `judgingFits()` was false. A
  first attempt at a flat $0.05 per call put the first decision inside the wrap-up (three decisions left offer no tools,
  `runtime/llm/loop-budget.ts`), so `core.run_node` was answered `not_offered`. Re-pinned: the provider prices every call
  at $0.02 and reports $0.02; the reading and nine decisions spend $0.20, the tenth ($0.02 beside $0.04 kept back) is
  refused unsent, the reserve stops the round, the draft is preflighted once, tested, and the pair judges it:
  `[false x9, true, true]`; summary now says "spending limit" (`STOPPED_SUMMARY.cost`), not "model call allowance".
- **generation it.each `finishes: false`**: the purse did keep the pair back (refusal `keptBackUsd: 0.0078`,
  `judgingFits` true). The stopped round's completion check refused the draft: `bootstrap.invalid_subflows`, because this
  stand-in's kept read (`keptRead`) names no node, so no plan can be written from it. Round 1's expectation (proposed, 2
  judges) never held for this fixture. Re-pinned to what the product does: rejected `evidence_budget_exhausted`, bound
  cost, `tested: not_tested`, more than 12 decisions, no judge call, the one-step draft kept.
- **incomplete-draft "keeps the proposable steps"**: the test still pinned `bound: "calls"` and "limit of 4 model calls"
  from before t1056. Re-pinned to `bound: "cost"`, "spending limit of $0.25", `tested: not_tested` (its acts name no node).
  The continuation half passes unchanged.
- The same describe's "still tests and judges a model-ready draft" and "preserves a refused draft" pass on the new fixture.

### 2. Re-pins

| Test | Cause | Change |
| --- | --- | --- |
| creation-spend (e) | the defect above | none; passes |
| refuted-result flow-purse-chain | the defect above | none; passes |
| unfinished-build "ends at its budget as a budget hit" | unpriced decisions (~20k tokens) held at ~$0.007 beside a pair kept back at ~$0.008: a $0.02 purse paid for 4 | purse $0.02 -> $0.05, so it runs well past the old counts before the purse ends it (passes, bound cost) |
| rejections x5 "feeds back, then reports" (surfaced after the fix) | decisions at $0.08 now held at $0.08 after the first: three fit beside the pair | pinned `n === 3`; loop detection's `loop_steered` rows are filtered out of the step assertion |
| generation "asks again after an unknown tool" (surfaced mid-run) | the other worker's loop detection now writes `core.decision_check` `loop_steered` rows into the trace | steps assertion filters those rows; decisions still all `unknown_tool_refused` |
| llm-run-caller "shares one atomic budget" | round 2 removed the declared count that sized the recovery's per-call share at the whole purse; with 24 shares the patch fits | resolver purse $0.01; the diagnosis reports $0.0099, so the patch's share ($0.01/24) no longer fits and is refused `llm_budget.run_cost_limit` |
| fluxnode lane (`service/fluxnode/tests/library-lane.ts`) | the scripted model priced nothing, so holds followed request size at default rates | the lane's model prices each call at what it reports ($0.001) |
| act-scope "resumes an explore execution" | an attempt keeps one judge call back (`answer-first/attempt/run-attempt.ts:111`): $0.001 paid for nothing | budget $0.002 |
| act-scope "a pipeline resumes each ..." and idempotency "owns its resume" | $0.0011 left the press inside the wrap-up, `not_offered`, so the act never landed and the resume had `answer_first.nothing_to_judge` | budget $0.0025: press offered and paid, completion ($0.0011 + $0.001 + $0.001 kept) refused |
| idempotency "returns one held execution" | as act-scope | budget $0.002 |
| pipeline-runs budget_out | $0.0001 is below any call's hold, so nothing is sent (it used to overspend 10x) | budget $0.0025 (judge off still keeps one call back) |

### 3. `runtime/conversations/commands/progress.ts`

The brief's path is `conversations/commands/progress.ts`; the file is `runtime/conversations/commands/progress.ts`.
`exhaustedWords` now takes `refusedSteps`: a candidate build's budget ending (`evidence_iteration_limit`) that carries
refused steps reads, for example, "it reached its spending limit while the Flow it wrote was still being refused, the last
time because the step 'Press ...' points at something that wasn't seen on the page"; where the codes have no words, it
names the steps ("... still being refused at the steps 'A', 'B' and one more step"). Nothing changes without refused
steps. Verified with a scratch test (deleted; the tests folder is not mine to own) and the existing
`candidate-endings.test.ts` and `plain-failure.test.ts`.

### 4. `maxCallsPerRun` stripped

From every fixture in my test paths (17 files): accounting, catalog, creation-spend, domain-instructions, extend,
generation, judged-build, permission-ask, permission, person-needed, plan-parameters (its option too), rejections,
state-digest-and-trace, reauthor-service, llm-diagnosis, run-consequence-permission, runtime-patches; with the comments
that explained a count. None remain in my paths.

## Commands run and observed results

- First run of the three judging-at-reserve files and the runtime incomplete-draft tests: `Tests 3 failed | 45 passed (48)` (the three in the brief).
- Final run of every owned test path, from `packages/fluxiq`:
  `pnpm exec vitest run src/runtime/llm/build-purse src/runtime/llm/purse src/runtime/flow-authoring/bootstrap/incomplete-draft src/framework/automation-service/tests/service-bootstrap src/framework/automation-service/tests/refuted-result src/framework/automation-service/tests/service-adaptation src/framework/automation-service/service/fluxnode src/runtime/conversations/commands/tests/candidate-endings.test.ts src/runtime/conversations/commands/tests/plain-failure.test.ts`
  -> `Test Files 3 failed | 96 passed (99)`, `Tests 7 failed | 494 passed (501)`. The 7 are the ones under "Open questions" 1 and 2, all caused outside my paths.
- `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1056-purse-check -- pnpm --filter fluxiq check` -> `exit 0` (tsc --noEmit, 170 s).
- `node scripts/structure-audit.mjs` -> one `[statement-packing]` violation in my `harness-hold.ts`, fixed; final `structure-audit: passed (577 warning(s), 896 baselined)`.
- Probes for tracing: `FLUXIQ_BUILD_PROGRESS_TRACE=1`, temporary `console.log` lines in `harness-hold.ts` (removed), scratch `t1056purse-probe.test.ts` files (all deleted).

## Not verified

- No live or paid run. The priced-hold fix is shown on scripted providers only.
- Not run: the whole fluxiq suite and real-sql groups outside my paths, so a test elsewhere that pins an unpriced provider's budget may have moved with the fix. Worth checking: `runtime/agents/budget`, answer-first, project-build and deepseek-bootstrap tests.
- `progress.ts` has no committed test. Its new wording was checked with a scratch test, because the tests folder is not mine.
- One rule slip: I ran an empty `node -e ""` once (a no-op), against the brief's "no node -e".

## Open questions or contradictions found

1. **A count of rounds still ends builds: plan-parameters x4 and unreadable-replies fail on it (not fixed, outside my paths).**
   They end `bound: "rounds"` after 6 rounds and 49-50 calls, not on the purse (round 2's report said "the purse ends at about 49 calls";
   that is not what ends them). Under round 2's loopSignal, each round ends as a stall at the top of the ladder. A build with nothing
   in its Flow then explores again (`runtime/flow-authoring/bootstrap/unfinished-build/phases.ts:555-565`), until the
   backstop `if (rounds >= maxRounds) return await end("rounds")` (`phases.ts:559`, also `:595`) with
   `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_ROUNDS = 6` (`runtime/loop-limits/flow-bootstrap-rounds.ts:17`). That is a count
   ending a build, against the user's 2026-11-24 rule. I did not re-pin these tests to "rounds", because that would enshrine the count. The
   decision belongs to the lead or to the worker who owns phases.ts and the loopSignal.
2. **A `diagnosis_only` run pays for a runtime patch it must never apply: llm-run-caller x2 fail on it (not fixed, outside my paths).** The
   recovery plan asks for a `runtime_patch` call whatever the intent. Only `diagnose_and_adapt` gets an intent check
   (`runtime/adaptation/recovery/annotation/annotate.ts:436` `explicitProposalRun`, `:449` `intentRefusal`, `:572`
   `patchWillFollow`). Before t1056, the resolver's declared count of 1 (round 1: costShares = 1) was what stopped the second call.
   Observed now: `["runtime_diagnosis","runtime_patch"]`; in case 1 the patch call fails `llm.provider_request_failed`,
   because the test's provider asserts on the call sequence. `in/run-repair.ts:116` says a diagnosis_only fix must never run, so
   the call is paid waste. Suggested fix: skip the patch request for `diagnosis_only` at the plan stage, with a skip code.
3. **An attempt with its judge off still keeps a judge call back.** `framework/automation-service/service/answer-first/attempt/run-attempt.ts:111` calls
   `automationStudioAnswerFirstKeepBackJudge(input.creation.purse)` unconditionally. With `judge: "off"` and no check,
   nothing ever spends it (pipeline-runs, act-scope), so the purse refuses decisions it could pay for. This was hidden for unpriced
   providers until round 2. I sized the tests' budgets around it rather than change answer-first.
4. **The lead's commit 70709836d contains my scratch probe** `framework/automation-service/tests/service-adaptation/tests/t1056purse-probe.test.ts`
   (319 lines). It was committed while I was working; it is deleted in the working tree, so that deletion needs committing.
5. **Pricing choice for review.** An unpriced provider's judge calls and its judging pair are held at the most a *judge*
   call reported, and before any judge has, at the default model's rates. Its other calls are held at the most *any* call reported. The
   first call of each kind can still overshoot once: there is nothing to measure before it. Holding the pair at the largest
   decision instead was tried: one $0.03 decision then kept $0.06 back in a $0.10 repair, which broke repair-purse-chain's
   three-call repair. That reads as over-holding, so I did not adopt it.
6. The purse class itself lives in `runtime/agents/budget` (not mine), so the fix sits in Studio's hold. A cleaner
   home would be the purse exposing `largestReportedUsd` and applying the rule itself for every caller, including any
   that bypass `runtime/llm/build-purse/harness-hold.ts`.

```text
Outcome: Partial
Changed: packages/fluxiq/src/runtime/llm/build-purse/{priced.ts,observed-cost.ts,harness-hold.ts,index.ts,tests/priced.test.ts}; runtime/conversations/commands/progress.ts; tests under framework/automation-service/tests/{service-bootstrap,refuted-result,service-adaptation} and service/fluxnode (re-pins, maxCallsPerRun stripped, library-lane priced); deleted service-adaptation/tests/t1056purse-probe.test.ts; this report
Validation: owned vitest paths -> 494 passed, 7 failed (plan-parameters x4, unreadable-replies, llm-run-caller x2; causes outside owned paths); pnpm --filter fluxiq check (heavy-slot) -> exit 0; structure-audit -> passed (577 warnings, 896 baselined)
Not verified: suites outside owned paths after the priced-hold fix; no live/paid run; progress.ts wording has no committed test
Report: C:/Users/osrs_/FluxStuff/fxwork/t1056/!FluxIQWebExtension/docs/working/page-diff-delivery-plan/reports/t1056-purse.md
Notes: Real purse defect fixed: unpriced calls were held at default rates below their cost, and the overshoot spent the judging reserve.
Blocked items: MAX_ROUNDS=6 ends builds (phases.ts:559/595), and diagnosis_only runs request a patch (annotate.ts:436-572).
Commit 70709836d includes my scratch probe file; its deletion is in the working tree.
```
