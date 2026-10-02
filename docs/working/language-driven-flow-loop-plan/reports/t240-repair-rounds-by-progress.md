# t240: repair rounds bounded by money and progress (with run 38's C8, second half)

Worker report. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t240/!FluxIQ`, branch `task/t240-repair-rounds-by-progress`.
`R/` = `packages/fluxiq/src/programs/automation-studio/runtime/`. Nothing committed.

## Outcome

**Done in Core, with one piece of caller wiring left outside my files.**

- The two-repair count is gone. Another round opens only when two things hold:
  - (a) the creation purse can fund one more decision plus the judging of its Flow, each at its capped hold;
  - (b) the round before it measurably progressed, going by what the test and the judge report.
- A round with no measurable progress ends the build `not_doable` and says what stood still.
- C8, second half: a round that ended on refused repeats and handed back the Flow it started from ends the build. This
  is done and tested. For an extend build's first round it needs a new input, `seedSignature`, which
  `R/service.ts` does not pass yet. That file is not in my brief (see Open questions 1).

## What changed and why

All of these are under `R/flow-bootstrap/unfinished-build/` unless a path says otherwise.

- **`phases.ts`**
  - **Count removed.** `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_REPAIR_ROUNDS` and the `maxRepairRounds` input are
    deleted. `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_ROUNDS` (6) is unchanged, and still caps live rounds as the
    published record reader's hard bound.
  - **(a) Funding.**
    - After each round the runner reads `purse.lastProjectedCostUsd`. That is the round's last priced call: its
      last decision, at the 2,000-token decision reply cap. `R/llm/evidence-loop.ts:628` already uses the same figure
      as `nextDecisionCostUsd`.
    - After the judge runs, a price that changed is the judge's, at the 2,000-token judge cap.
    - What one more round needs = decision hold + judge hold. The judge hold counts only where the build has a judge.
    - A judge not yet priced is held at the decision's price. That is an upper bound: run-muqiho7e's judge request
      was 12.8k chars, against 113k for a decision, under the same reply cap.
    - `exhaustedBound` returns `cost` when the purse has less left than that. It applies both to repairs and to the
      "explore again" path for an empty Flow.
    - Where nothing has been priced (a provider that does not price), the old "purse empty" test stays.
    - No-purse builds keep the old arithmetic.
  - **(b) Progress.** The check now uses `automationStudioFlowBootstrapJudgementProgress`. It replaces
    `automationStudioFlowBootstrapJudgementAdvanced`, which is removed from `judgement.ts`.
  - **C8.** After phase 2, a round with `stopped === "repeat_without_progress"` ends with `not_doable` when its
    judged `flowSignature` equals the signature of the Flow it started from. That starting Flow is:
    - for a repair: `repair.seed`;
    - for round 0: `input.seedSignature`;
    - after an empty-Flow round: none.
  - Empty Flows are left to the t208 rule (explore again), so C8 never fires on them.
- **`progress.ts` (new).** The measure, read only from the data the rounds already carry. Progress is any of:
  - more acts done (`done`);
  - more acts proven by the test (`proven`);
  - a test that now runs clean;
  - a failing test with fewer failed steps;
  - with no judge on either side, more steps that worked when run;
  - a round that finished and was judged where the round before stopped short;
  - carried steps now judged (verdict `unknown` or `not_judged` -> `no`);
  - a judge finding code from the round before that is no longer reported.

  A Flow that is merely different is **not** progress (the old judged-side rule was "signature changed"). Neither is
  the judge's wording, nor a raw step count.
- **`contracts.ts`.** New types `AutomationStudioFlowBootstrapProgressMeasure` and
  `AutomationStudioFlowBootstrapNoRouteLeft` (`no_progress` with `before` | `repeated_unchanged`).
- **`not-doable.ts`.** Takes an optional `noRoute` and names what stood still. Examples:
  - "...and the last repair made no measurable progress on the round before it: it handed back the same Flow; no more
    of the 3 things you asked had a step (3, as before); the judge found the same as before."
  - C8: "...the last attempt ended on refused repeats of the same calls and handed back the Flow it started from,
    unchanged, so another round would only repeat it."
- **`budget-exhausted.ts`.**
  - New type `AutomationStudioFlowBootstrapNextRoundHold` and a field `CostSpending.nextRound`. An unfunded round is
    said as: "it had spent $0.085, which left $0.015, too little for another round: its next decision and the judging
    of its Flow could cost up to $0.040."
  - `sizes.maxRepairRounds` is removed. The `repair_rounds` bound stays in `generation-failure` (not my file),
    because published records may carry it; its text is now "its limit on repairs".
- **`index.ts`.** Exports `progress.ts`.
- **Tests.**
  - New: `tests/repair-rounds.test.ts`, with 8 tests.
  - `phases.test.ts`: dropped the repair-limit test, which is now covered by the new backstop test; the not-doable
    test asserts the stood-still sentence.
  - `judged.test.ts`: dropped "ends at the repair limit ... different Flow still judged no", which is now the
    no-progress case in the new file; the same-Flow test asserts the new sentence.
  - `budget-figures.test.ts`: `maxRepairRounds` removed from `sizes`.
- **Docs.**
  - `docs/architecture/automation-studio/llm-flow-bootstrap.md`: the repair paragraph, plus the `not_doable` and
    `evidence_budget_exhausted` trigger rows.
  - `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md` were
    regenerated, since the public exports changed.

## C8, second half (run 38): a round of refused repeats with the Flow unchanged

- **Rule.** A round that ended on `llm_evidence_loop.repeat_without_progress` (round-ending maps it to
  `stopped: "repeat_without_progress"`) and whose judged Flow signature equals its starting signature ends
  `not_doable` with `noRoute: { kind: "repeated_unchanged" }`. It never opens a second identical round.
- **Starting signature.**
  - Round 0: `input.seedSignature`. This is new and optional; absent means round 0 started from nothing.
  - Repair rounds: `automationStudioFlowDraftReplaySignature(repair.seed)`, recorded when the repair opens.
- **Tests** (`repair-rounds.test.ts`, describe "a round that ended on refused repeats..."):
  - an extend first round seeded and handed back unchanged makes 1 round, not 2 (failing-first: the old code opened
    round 1);
  - a repair that hands back its seed unchanged ends with the C8 sentence (failing-first on the wording);
  - controls: a first round that changed its Flow, or one with no `seedSignature`, still repairs.
- **Not wired.** `R/service.ts:1617` must pass `seedSignature`, and service.ts is not in my brief. Round 0 is seeded
  at `service.ts:1589` from `repair ?? (extend ? { seed: extend.seed.steps } : keeper.draft ?? {})`. So a kept
  continuation draft seeds round 0 as well as an extend seed. The suggested wiring is
  `seedSignature: automationStudioFlowDraftReplaySignature(<the seed steps round 0 is given>)` when non-empty. I have
  not verified `keeper.draft`'s shape.

## Commands run and observed results

- **Failing-first.** I restored the six original source files from `HEAD` (kept copies in my scratchpad), ran the new
  test file, then put my versions back.
  - Command: `npx vitest run .../unfinished-build/tests/repair-rounds.test.ts` (in `packages/fluxiq`).
  - Result: `Tests 7 failed | 1 passed (8)`.
  - The failures were "no round 1 scripted" or "no round 2 scripted": the old code opened a round it should not
    have. The "past two repairs" and "backstop" tests failed on `repair_rounds`.
  - The passing test is the control, which should pass under both versions.
- **Beside the changed files.**
  - Command: `bash .../heavy.sh "t240-tests" npx vitest run src/.../unfinished-build/tests src/.../runtime/tests/service-bootstrap/tests/unfinished-build.test.ts`
  - Result: `Test Files 10 passed (10)`, `Tests 72 passed (72)`.
- **Package check.**
  - `bash .../heavy.sh "t240-check" pnpm --filter fluxiq check` printed no errors (the build-cache line `"step":"fluxiq:check"`).
  - Re-run directly: `check exit 0`.
  - Before the test edits, `tsc --noEmit` showed exactly the two expected `maxRepairRounds` test errors.
- **Structure audit.** `bash .../heavy.sh "t240-audit" node scripts/structure-audit.mjs` printed
  `structure-audit: passed (218 warning(s), 349 baselined)`, the same count as before my edits. `phases.ts` (527
  lines) carries the 400-line advisory warning it already had at 459 lines.
- **Framework reference.** `node scripts/docs-reference.mjs` printed `Wrote docs/reference/framework-reference.md and
  packages/fluxiq/docs/reference/framework-reference.md (2962 public declarations)`. Only my exports' rows changed.

## Not verified

- No live run and no provider call. The funding figures come from scripted purses.
- That `purse.lastProjectedCostUsd` after a round is always a decision's price. Two cases I did not check:
  - a tool that makes its own priced model call inside a round would set it instead;
  - a repair that made no priced call would leave the judge's price there.

  Both err toward a smaller hold, not a larger one, only where such calls exist.
- The `seedSignature` wiring in `service.ts`; see C8 above.
- Whether run-muqiho7e's checklist `done` count rose between its rounds. Its step logs show only the judge's account.

## Open questions or contradictions found

1. **Wiring `seedSignature`** in `R/service.ts` (see C8). Until it is wired, C8's round-0 case does not fire in
   production. The repair-round case does.
2. **The premise "earbuds was still converging" is not what its judge reported.**
   - Run-muqiho7e's three judge verdicts (`steps/0038-judge`, `0068-judge` and `0079-judge` under
     `lab-runs/2026-10-01/run-muqiho7e-13be6c03/`) each say no step reads, filters or stores records.
   - Each round only added navigation steps; the third added a navigate back to the store home.
   - The third verdict carries `stillAchievable: "no"`.
   - Its finding codes are empty every time: `result.no_record_set` is filtered out by the build-test judge.
   - The old rule counted "different Flow" as progress. Under the new measure this build would end after its first
     repair as `not_doable`, with "the judge found the same as before", unless its checklist `done` count rose.
3. **The smallest addition for "fewer missing or extra records, a refuted condition now held".**
   - The rounds do not carry record counts. The build-test judge (`R/result-verification/build-test/judge.ts`,
     must-not-touch for me) returns only finding codes, `expected`, `observed` and `advice`.
   - The counts exist in the summary it judges (`AutomationStudioRunResultSummary`: `totalRecordCount`,
     `totalRefusedCount`, `totalRowsMissingRequired`).
   - Proposal: return those three counts on a `no` verdict, and add a `records_improved` measure to `progress.ts`.
   - Refuted or held conditions belong to recovery, not to a build's test.
4. **The no-progress ending keeps `kind: "not_doable"`** (code `flow_bootstrap.not_doable`), as the existing lifecycle
   defines it. The message states the no-progress reason. A separate kind or bound (for example `no_progress` in
   `generation-failure/build-ending.ts`) would need that file, which is outside my brief.
5. **"More working steps" counts as progress only where neither round was judged.** It is the test's report, but it
   lets a judge-less build that adds working navigation steps continue until money or the 6-round backstop stops it.
   Say if you want it dropped.

## Follow-up (coordinator, after commit 7c108850): Open questions 1 and 3

Done in the same tree, on Core HEAD `4e695f10` (dev merged in). Nothing committed. Q4 and Q5 are unchanged, as
instructed.

### Q1: round-0 `seedSignature` wired from `R/service.ts`

- **The call.** `R/service.ts`, the `runAutomationStudioFlowBootstrapBuildPhases({...})` call (about line 1618),
  now passes `seedSignature: automationStudioFlowDraftReplaySignature(seed)`. `seed` is
  `extend ? extend.seed.steps : keeper.draft?.seed`, the same Flow round 0's `draft` is seeded from at line 1589.
  It is passed only when non-empty.
- **Imports.** `automationStudioFlowDraftReplaySignature` was added to the existing `./flow-draft/index.ts` import.
- **Line budget.** The wiring sits on the existing `judge: ...` line, with a trailing comment. `service.ts` is held
  to its 4,489-line baseline: my first version added 2 lines and the audit failed with "4491 lines exceeds ...
  Baseline for this entry is 4489". The diff is now `2 2` (net zero), and the audit passes.
- **Test.** `R/tests/service-bootstrap/tests/unfinished-build.test.ts` gains "a continuation whose first round ends on
  repeats with the kept draft unchanged":
  - It goes through the real `generateFlowBootstrapAdaptation`.
  - Build 1 adds steps until its 12 declared calls run out; its draft is kept.
  - Build 2 presses again and again to no effect, adding nothing, until the loop's no-progress guard ends round 0 on
    `repeat_without_progress`.
  - It expects `flow_bootstrap.not_doable`, `tried.rounds: 1`, and the C8 sentence.
  - Failing-first: with `service.ts` restored from `HEAD` it fails on `tried.rounds`. The second round opened, and the
    repair-round C8 case only caught it after that. With the wiring it passes.

### Q3: the judge returns record counts; progress counts them

- **`R/result-verification/build-test/judge.ts`.**
  - New type `AutomationStudioBuildTestRecordCounts { stored, refused, missingRequired }`.
  - The `no` variant of `AutomationStudioBuildTestVerdict` gains a required `records`, read from the judged summary's
    `totalRecordCount`, `totalRefusedCount` and `totalRowsMissingRequired`.
  - The verdict type lives in `judge.ts`, so `result-verification/contracts.ts` and `read-account/**` are untouched.
  - `service/flow-bootstrap-commands/build-judge.ts` passes the verdict through unchanged, so no edit was needed there.
- **`unfinished-build/contracts.ts`.**
  - New type `AutomationStudioFlowBootstrapJudgedRecords`.
  - Optional `records` on the build's `no` verdict and on `AutomationStudioFlowBootstrapJudgedWrong`.
  - Three new progress measures.
- **`unfinished-build/judgement.ts`.** `judgedWrong` copies `records` into the judgement. It is not added to the
  repair's resume value, so the prompt is unchanged.
- **`unfinished-build/progress.ts`.** When both judgements are `no` and both carry counts, each of these is progress:
  - `records_stored`: rows stored where none were;
  - `fewer_records_refused`: fewer refused, with no fewer stored;
  - `fewer_records_missing_required`: fewer missing a required value, with no fewer stored.

  "No fewer stored" keeps a Flow that stopped reading from counting as fewer refusals.
- **Tests (failing-first).**
  - `build-test/tests/judge.test.ts`: "carries the summary's stored, refused and missing-required counts on a no".
  - `unfinished-build/tests/repair-rounds.test.ts`, describe "a repair judged wrong for the same findings, measured by
    what its test stored":
    - three cases that repair again (fewer refused, fewer missing-required, stored where none were);
    - one control: fewer refused only because fewer were stored ends `not_doable`.
  - With `progress.ts`, `judgement.ts` and `judge.ts` restored from `HEAD`: `Tests 4 failed | 25 passed (29)`. The
    failures were the three progress cases plus the judge test; the control passed. With the changes: `29 passed`.
- **Docs.** `docs/architecture/automation-studio/llm-flow-bootstrap.md`: the progress bullet names the record
  counts, and the C8 sentence says `service.ts` passes `seedSignature`.

### Commands run and observed results (follow-up)

- **Tests beside every changed file.**
  - Command: `bash .../heavy.sh "t240-tests2" npx vitest run` over `unfinished-build/tests`,
    `result-verification/build-test/tests`, and the service-bootstrap tests `unfinished-build`, `judged-build`,
    `incomplete-draft` and `extend`.
  - Result: `Test Files 16 passed (16)`, `Tests 124 passed (124)`.
  - After the one-line fold in `service.ts`: `service-bootstrap/tests/unfinished-build.test.ts` -> `Tests 5 passed (5)`.
- **Package check.** `pnpm --filter fluxiq check` (through heavy.sh) -> `check exit 0`, both before and after the
  fold.
- **Structure audit.** `node scripts/structure-audit.mjs`:
  - first run: `1 violation(s)`, the `service.ts` line baseline above;
  - after the fold: `structure-audit: passed (218 warning(s), 349 baselined)`.
- **Framework reference.** `node scripts/docs-reference.mjs` -> `Wrote docs/reference/framework-reference.md and
  packages/fluxiq/docs/reference/framework-reference.md (2972 public declarations)`. That adds the two new record
  types; the other changed rows are line-number shifts.

### Not verified (follow-up)

- No live run. Production C8 still depends on two things I have not checked:
  - whether the loop hands back seeded steps with the same `actionId` and `ranWith`, so that the signatures compare
    equal; the service test shows they do for a kept continuation draft;
  - whether that holds for an extend seed, which is untested at the service level.
- The repair model is not told the record counts. Whether it should be is a prompt decision I left alone.

