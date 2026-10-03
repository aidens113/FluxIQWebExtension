# t254 stage 2, w3: judge overshoot in accounting; the judging reserve spent judging

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t254/!FluxIQ` (Core), branch `task/t254-purse-holds-true-cost`. Nothing staged or committed.

## Outcome

**Done.** Both decisions are implemented and tested, including an end-to-end service test. The brief's vitest set and every directory I touched pass: 130 files, 1,583 tests. `tsc --noEmit` is clean, and the structure audit passes.

## What changed and why

### Decision 3: judge overshoot reaches the build's accounting

- `U/phases.ts`: there is a new private `judgeAccounted(input, judge, request, spent, elapsedMs)`. It asks the judge within the purse's `leftUsd()`, as before. It then adds the verdict's spend and the purse's breaches and overshoot to `spent`. Breaches and overshoot are read as a delta of `purse.breaches` and `purse.overshootUsd` across the judge call, which is the same delta method `llm/evidence-loop/cost-purse.ts` uses for decisions. The delta is exact because nothing else draws on the purse while the judge runs: rounds and their judging run one after another. An `AbortError` returns `"cancelled"`, and the caller ends the build `llm_evidence_loop.cancelled` as before. The finished-round judge and the new reserve judge both go through this function.
- Result: a build's `accounting.estimatedCostUsd`, `budgetBreaches` and `budgetOvershootUsd` equal the purse's `spentUsd()`, `breaches` and `overshootUsd`. This assumes the judge's verdict reports what its calls settled at.

### Decision 4: a round the judging reserve stopped spends the reserve judging the Flow so far

- `U/reserve-judging.ts` (new; exported from the barrel): `automationStudioFlowBootstrapJudgeAtReserve`.
  - It takes the round's tested judgement and seed, from `automationStudioFlowBootstrapJudgeUnfinished` with a test.
  - It returns `not_judged` when any of these holds:
    - nothing is in the Flow;
    - the test was not `replayed_clean` (an unreplayable Flow, a failed test, or the evidence limit);
    - the caller's `accept` refuses the Flow.
  - Otherwise it builds an ok loop: `result: { summary: "Flow built from the steps that ran before the build reached its spending limit." }`, the round's trace and accounting, and `steps` = the tested seed, so step positions match the test report.
  - It then asks the judge. A yes whose `flowSignature` equals `automationStudioFlowDraftFlowSignature(seed)` returns `finished`. Any other verdict returns `judged`, carrying the judge's account on the judgement and what judging cost.
- `U/phases.ts` changes:
  - `atReserve` is true when all of these hold: `ending.kind === "budget"`, bound `cost`, a purse, a judge, and `exhaustion.costRefusal.keptBackUsd > 0`.
  - On that path the round is tested with `input.test(steps, { judged: true })` and announced as "Running the Flow as far as it got from its start, and judging it with what was kept back for judging."
  - Then:
    - `finished`: returns `{ kind: "finished", loop, judged: verdict }`.
    - `judged`: replaces phase 2's judgement and records `judgedAtStopUsd`.
    - In every other case the existing `if (ending.kind === "budget") return await end(ending.bound)` runs.
  - This path never returns `not_doable`, because it returns before the not-doable check.
  - New optional input `acceptStopped(loop): Promise<boolean>`.
  - `costSpending` takes `judgedAtStopUsd`. When it is set, it reports the purse's current figures: spent now, no `keptBackUsd`, the refused call's `projectedCostUsd`, and `judgedUsd`.
  - `yesNotAboutThisFlow` moved to `judgement.ts` as `automationStudioFlowBootstrapYesNotAboutThisFlow`, unchanged.
- `U/judgement.ts` changes:
  - `AutomationStudioFlowBootstrapUnfinishedTest` takes an optional `{ judged: true }`. Existing calls still pass only `(steps)`.
  - New export `automationStudioFlowBootstrapWithJudgeAccount(judgement, verdict)`, which adds the judge's account to a tested judgement.
  - New export `automationStudioFlowBootstrapYesNotAboutThisFlow`.
- `U/budget-exhausted.ts` changes:
  - `AutomationStudioFlowBootstrapCostSpending.judgedUsd` is new.
  - When it is set, the spending clause reads: `: its next call could have cost up to $P, more than was left beside what was kept back for judging the Flow, so that went on testing and judging the Flow as it stood ($J), and it had spent $S (… earlier builds) in all`.
  - A findings sentence follows the test sentence: `The judge found: <observed or first finding>. What the judge says is left to change: "<advice>".` An unsure or not-judged verdict reads `The judge could not confirm it: <why>.` Each part is cut at 200 characters.
  - The kept sentence is unchanged ("kept as a draft, not put into the Flow …"). The "left of this Flow's ceiling" tail now uses the spend after judging.
  - Wording of existing cost endings is unchanged, because the new text appears only when `judgedUsd` is set.
- Caller wiring:
  - `R/service/flow-bootstrap-commands/build-judge.ts`: new `judgedTest()`. It clears any kept test and returns the gate's `observed` (into `lastTest`) and `endView`, so the judge reads that test or none.
  - `R/service.ts`: no net line growth; the file sits at its 4,418-line baseline cap. Three changes:
    - The completion check call became a shared `completion(result, draftSteps)` closure, defined on the `accepted` line and used by `checkCompletion`.
    - The phases `test` spreads `buildJudge.judgedTest()` when `options?.judged`.
    - `acceptStopped` runs `completion(loop.result, loop.steps)` and sets `accepted.verdict`, so the plan built is the draft's. Without this, a stale earlier round's accepted plan could have been built, or the build could have failed `evidence_completion_plan_invalid`.
- `docs/architecture/automation-studio/llm-flow-bootstrap.md` changes:
  - The purse "holds" bullet now says a judge breach reaches the accounting.
  - A new bullet, "The judging reserve is spent judging, never left".
  - The "Judging is kept back" bullet points to the new bullet.

## Commands run and observed results

All from `packages/fluxiq` unless noted.

- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/llm/build-purse src/programs/automation-studio/runtime/service/flow-bootstrap-commands src/programs/automation-studio/runtime/tests/service-bootstrap` printed `Test Files  130 passed (130)` and `Tests  1583 passed (1583)`. This was the final run, after the merge described below.
- An earlier run of the brief's three directories plus `service/flow-bootstrap-commands` printed `Test Files 106 passed (106)` and `Tests 1455 passed (1455)`.
- `npx vitest run src/programs/automation-studio/runtime/tests/service-bootstrap src/programs/automation-studio/runtime/tests/deepseek-bootstrap` printed `Test Files 26 passed (26)` and `Tests 137 passed (137)`. This ran before the new service test was added.
- `npx tsc --noEmit -p .` printed nothing (`tsc exit=0`).
- `node scripts/structure-audit.mjs` (Core root) printed `structure-audit: passed (234 warning(s), 349 baselined).`
  - The first run failed: `[directory-files] …/tests/service-bootstrap/tests/: 26 source files exceeds the 25-file limit`. That was my new `reserve-judging.test.ts` there.
  - I merged its two tests into `judged-build.test.ts` and deleted the separate file.
  - The one new warning is `judged-build.test.ts` at 455 lines, past the 400-line advisory.
- `node scripts/structure-audit.mjs --rule docs-links` printed `passed`.

New and changed tests:

- `U/tests/judge-overshoot.test.ts` (decision 3):
  - A round decision held at $0.008 is billed $0.010.
  - Two judge calls follow; the second is held at $0.002 and billed $0.005.
  - The test asserts `accounting.estimatedCostUsd == purse.spentUsd()`, `budgetBreaches == purse.breaches` (2), and `budgetOvershootUsd == purse.overshootUsd` ($0.005).
  - A second case asserts that no breach is recorded when the judge stays within its hold.
- `U/tests/reserve-judging.test.ts` (decision 4), five cases:
  - Judged yes: the build finishes, and `acceptStopped` and the judge both see the seed.
  - Judged no with `stillAchievable: "no"`: the ending is `budget_exhausted` cost, with the judge's findings and "kept as a draft", not `not_doable`.
  - A yes about another version of the Flow: the message says "could not confirm".
  - A failed test, a refused accept, or an empty draft: no judge call, and the ending is at cost.
  - A cost stop with no `keptBackUsd`: no test, no judge, and the message unchanged.
- `U/tests/murzln6g-repair-funding.test.ts`:
  - At peak, the refused first repair decision now leads to `tests == [{ steps: 3, judged: true }]` and both round-1 judge holds `ok`, then `finished` with steps d1–d3. Spend is $0.0889 + $0.00277, with no breach.
  - A new peak "judged no" case asserts the exact message:
    - "…its next call could have cost up to $0.007, more than was left beside what was kept back for judging the Flow, so that went on testing and judging the Flow as it stood ($0.003), and it had spent $0.092 ($0.081 of it by earlier builds of this Flow) in all."
    - "The judge found: the saved items list was empty. What the judge says is left to change: …"
    - "…kept as a draft…, with $0.008 left of this Flow's $0.10."
  - The off-peak case is unchanged.
- `R/service/flow-bootstrap-commands/tests/build-judge.test.ts`: `judgedTest()` drops a test kept earlier, and its `observed` stamps the verdict's `flowSignature`.
- `R/tests/service-bootstrap/tests/judged-build.test.ts`: two end-to-end cases through `generateFlowBootstrapAdaptation`. They use a priced provider at $1 per million tokens and a native-node stand-in.
  - Yes: `proposed`, requests `[decision, judge, judge]`, a replay of the read, and a plan whose nodes are the draft's `[domain.example.read]`.
  - No: `flow_bootstrap.evidence_budget_exhausted` cost, with findings, advice and "kept as a draft".

## Not verified

- No live browser or Lab run; this is unit and service-level only.
- Pass and fail rates of the extra test run of the Flow so far against a real web domain.
- The quality of a judge verdict built from the synthesized result. It carries only a summary, so the judge sees no `result.acts` claims.
- I did not run the full `pnpm check` or the whole fluxiq vitest suite, per the twice-a-day rule.
- The changes to `deepseek/`, `recovery/` and `harness/provider.ts` in the tree belong to other workers and were not touched.

## Open questions or contradictions found

1. **Re-judging a Flow already judged no.** At peak, murzln6g's repair is refused its first decision, so the "Flow so far" is exactly the seed round 0's judge already said no to. The brief asks for that Flow to be judged again, and it now is. This spends about $0.003 to re-ask about an unchanged Flow. A cheaper rule would end at cost with the previous judge's findings when the Flow's signature equals the last judged one. That needs a supervisor decision.
2. **Not judged where a yes could finish nothing.** These cases are a choice beyond the brief, which named only the empty and unreplayable cases. They end at cost with the reserve unspent:
   - a failed test, since the build judge reads only a passing test;
   - a Flow the completion check refuses. A stand-in domain whose steps are not registry nodes cannot be written from the draft, which is how a first version of the service test failed.
   
   If the supervisor wants findings bought even when a finish is impossible, the order in `reserve-judging.ts` changes (judge before `accept`).
3. The test of a reserve-stopped Flow now passes the gate `endView`. That is one free look at the page, through the executor, when the test passes, as the loop's own test does. Settled paths, meaning the plain stopped-round test, do not get it.
4. `judged-build.test.ts` is now 455 lines, an advisory warning. Splitting `service-bootstrap/tests/` into subdirectories would be the structural fix, but that directory is outside this brief.
