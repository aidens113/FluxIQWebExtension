# t194-w70: a re-author round that was never tested no longer ends "not doable"

Worker t194-w70, for lead t194-lead-1002M. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`,
R/ = `packages/fluxiq/src/programs/automation-studio/runtime/`. No commits.

## Outcome

Done. I reproduced the murwcmx2 C-F chain in a failing test first: two re-author rounds, both
`unusable_decisions`, both `not_tested`, ended `unfinished`/`not_doable` at round 2. The same test now
passes. Round 3 is told which steps have not run, reruns them, and the build finishes on a judged `yes`.

## What changed and why

- `R/flow-bootstrap/unfinished-build/not-run.ts` (new):
  - `automationStudioFlowBootstrapStepsNotRunInThisBuild(steps)` returns the positions of proposed steps
    that are carried (`f<n>`) and have no `ranWith` or no `replay`. These are exactly the steps the dry-run
    gate refuses as `not_run_in_this_build`.
  - The `f<n>` test is a local copy of `automationStudioFlowDraftStepCarried`. Importing the real one would
    add a value edge into `llm/node-tools`, whose barrel imports the flow-bootstrap barrel. That would close
    a module cycle, and reaching past the barrel is ratcheted by the audit.
  - A test checks that the copy agrees with the original over sample ids. Exported from the barrel.
- `contracts.ts`:
  - New `AutomationStudioFlowBootstrapJudgement.notRunInThisBuild?: number[]`.
  - New progress measures `fewer_steps_not_run` and `flow_changed_unmeasured`.
  - The doc on `NoRouteLeft` now says neither not-doable case is concluded from such a round.
- `judgement.ts`:
  - Both judgements (round stopped short, round finished but judged wrong) now record `notRunInThisBuild`.
  - A finished round that still holds such steps counts as `not_tested`.
  - `automationStudioFlowBootstrapJudgementValue` passes `notRunInThisBuild` on to the resume.
- `progress.ts`:
  - New `automationStudioFlowBootstrapJudgementUnmeasured(j)`. It is true when the judgement or the judge's
    `untestedCarried` names steps that never ran.
  - Progress for such a round means fewer steps not run (this also counts for the first measured round
    after it), or a changed Flow. A changed Flow is still never progress between two measured rounds.
- `phases.ts`:
  - `repeated_unchanged` and `no_progress` are checked only when the round was measured. An unmeasured
    round goes on to the next repair under the existing money and round bounds (purse hold check, time,
    tokens, calls, and `maxRounds`, which is at most 6).
  - The repair announcement names the steps that have not run. When the round before held them too and
    this round ran none of them, it says so.
  - The measured endings are unchanged. A header paragraph explains the rule.
- `not-done.ts`:
  - When the judgement names steps that never ran, the ending's test sentence now reads: "The Flow as it
    stands (N steps) was never run whole from its start: steps 1 and 2 came from the Flow being changed and
    were not run again in this build, so it was never tested or judged."
  - The budget and rounds endings therefore say this honestly. The ending kind stays `budget_exhausted`.
  - New `automationStudioFlowBootstrapRepairingNotRunSaid` builds the announcement. A private
    `positionsSaid` formats the step lists ("step 3", "steps 1 and 2", "steps 1, 2 and 4").
- `R/llm/evidence-loop/resume.ts`:
  - When `judgement.notRunInThisBuild` is set, the repair's resume names those steps. It says the Flow
    could not be run from its start, and that it can be tested only once each step is rerun live in the
    Flow's order (`amend_draft rerun`, with consequences, `[]` when there are none). These are the words of
    full-run-required.
  - It also says a rerun of a carried step is first put back where its node started in the refuted run
    (w64), to keep the existing changes, and then to complete.
  - When a judge's account names no `untestedCarried`, the judgement's `notRunInThisBuild` is named
    instead, in the existing words.
- `R/recovery/refuted-result/brief.ts`:
  - New lines before the findings say: "None of your draft's steps has run in this repair". They say the
    Flow is tested, and the repair finished, only by a whole-Flow run from its start. They tell the model to
    rerun each step live in order (`amend_draft rerun`, with consequences), say where a rerun is put back,
    and end with "Then complete".
  - Step 5 of the read list and of the acts list now says that steps keep their parameters but are still
    rerun live, in the Flow's order. The old text was "keep the steps that reach the page as they are".
- `R/flow-draft/full-run-required.ts` (wording only): the `not_run_in_this_build` sentence now adds where a
  rerun is put back. The header now cites brief.ts and resume.ts.
- Tests:
  - New `unfinished-build/tests/never-run-whole.test.ts`:
    - the judgement names the steps and they are never tested by Core;
    - the murwcmx2 reproduction, including both announcements and no "Running the Flow" announcement;
    - a carried Flow handed back unchanged on refused repeats is repaired again;
    - at the round limit the build ends `budget_exhausted`/`rounds` with the never-run-whole sentence;
    - measured rounds still end `not_doable`/`no_progress`;
    - the progress measures;
    - the predicate agrees with `automationStudioFlowDraftStepCarried`.
  - New `recovery/refuted-result/tests/brief-rerun-carried.test.ts`, for both the read and the acts briefs.
  - Four cases added to `llm/evidence-loop/tests/resume.test.ts`. I folded them in there because a new
    file would have taken that directory to 26 files and failed the audit.
  - No existing pins needed changing.

## Commands run and observed results

The commands below ran from `packages/fluxiq` unless noted.

- Failing first: `npx vitest run` over the three new test files gave "Tests 10 failed | 4 passed (14)".
  The murwcmx2 case received `"kind": "unfinished", "rounds": 2` where `finished`/3 was expected.
- After the fix, the same files gave "Test Files 3 passed (3) / Tests 15 passed (15)".
- `npx vitest run R/flow-bootstrap R/recovery R/llm/evidence-loop R/service/runtime-adaptation
  R/service/flow-bootstrap-commands R/flow-draft R/tests/deepseek-bootstrap` gave "Test Files 2 failed |
  163 passed (165) / Tests 4 failed | 2029 passed (2033)". The four failures are not from this change:
  - They are `tests/deepseek-bootstrap/tests/exploration.test.ts`, the three cases "asks again after a
    malformed decision", "asks again after a provider decision reaches its deadline" and "records a build's
    token totals ...". The fourth is `answerability.test.ts` "converges through the judge's no ...".
  - Each fails `expect(run.judgeRequests).toHaveLength(1)` with "got 2" (one fails "length of 3 but got 4").
  - The cause is the concurrent uncommitted `confirmAnswer` change in `R/result-verification/verify.ts` and
    `agreement.ts` (modified 23:04, during this task; C-C, a first `yes` is now asked again). These tests
    still pin a single judge call. I do not own them.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w70 pnpm check fluxiq" pnpm check`:
  - First run: TS2379 at `never-run-whole.test.ts(148,109)` (`standsFor: string | undefined`). Fixed.
  - Rerun: `{"build-cache":"build","step":"fluxiq:check","reason":"no stamp; stored in the shared store
    ..."}` with no error and no ELIFECYCLE.
- From the Core root, `node scripts/structure-audit.mjs`:
  - First run: `FAIL [directory-files] .../llm/evidence-loop/tests/: 26 source files exceeds the 25-file
    limit`. Fixed by folding the new file into resume.test.ts.
  - Rerun: "structure-audit: passed (223 warning(s), 349 baselined)".
  - Advisory warnings on files I touched: `unfinished-build/` now holds 16 files (threshold 15), and
    `phases.ts` is 575 lines (threshold 400; it was 551).
- System-prompt pins: none changed. The new words reach the model only as the resume entry and the brief
  instruction.

## Not verified

- No live run. I did not check whether the model actually reruns the carried steps when told to, or what
  that costs.
- The full suite was not run (by rule).
- The four deepseek-bootstrap failures were not re-checked on a tree without the `confirmAnswer` change.
  Stashing would disturb other workers' uncommitted files. The cause rests on the failing assertion (judge
  call count) and the verify.ts diff.

## Open questions or contradictions found

1. What happens to an unmeasured round that made no progress. It is never ended "not doable", and it does
   not end the build early either: the closed ending kinds (`build-ending.ts`, which I do not own) have no
   honest word for "stopped: never run whole". Such rounds therefore go on until the money or round bound
   ends them, and the budget ending then says the Flow was never run whole. The cost is at most 6 rounds
   under the purse. If the lead wants an earlier stop (for example two unmeasured rounds in a row with no
   progress), it needs a new ending kind such as `never_run_whole` in
   `R/flow-bootstrap/generation-failure/build-ending.ts`, plus its code, its parser, and the extension's
   reader.
2. Behaviour change for extend builds. The first round of an extend build that hands back its carried
   (`f<n>`) seed unchanged on refused repeats used to end `repeated_unchanged`. It now opens another round.
   Existing tests use run steps (`d<n>`) and still end as before.
3. The `f<n>` predicate is duplicated, with a guarding test. The clean fix is to move
   `automationStudioFlowDraftStepCarried` into `R/flow-draft/` so that both sides import it. That touches
   `R/llm/node-tools/**`, which I may not edit.
4. The deepseek-bootstrap judge-count pins need updating by whoever owns the `confirmAnswer` change.

## Doc paragraph for Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`

> **A round that could not be measured is never "not doable" (t194-w70).** A re-author or extend build
> seeds its draft from a stored Flow. Each step it carries (`f<n>`) has nothing it ran with and nothing to
> put the target back with until it is rerun live, and Core never runs such a step itself, because the
> permission gate reads its missing consequence declaration as "none". A round whose Flow still holds one
> is therefore not tested at its end. Its judgement names those steps (`notRunInThisBuild`), and
> `repeated_unchanged` and `no_progress` are never concluded from it, since there is no measurement to
> compare. Live run murwcmx2's re-author ended not doable with the advised fix in its draft, never run from
> the Flow's start. Such a round is repaired again under the same money and round bounds. Its progress is
> fewer steps not run, or a changed Flow, and the announcement says which. The repair's resume names the
> steps and tells the model to rerun each live, in the Flow's order (`amend_draft rerun`), before
> completing. A rerun of a carried step is first put back where its node started in the refuted run. The
> re-author's brief says the same up front, and its step 5 no longer says to keep steps as they are without
> running them. If money or the round limit runs out first, the budget ending says the Flow as it stands
> was never run whole and names those steps.
