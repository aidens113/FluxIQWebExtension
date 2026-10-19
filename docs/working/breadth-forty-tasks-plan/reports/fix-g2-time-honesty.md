# Fix G2: time honesty (judge time, honest ending, no false "ready")

Worker report for brief G2. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t725/!FluxIQ`, branch
`task/t725-judge-time-honesty`. No commits, Lab runs or browser runs.

## Outcome

Done. All three requirements are implemented, each with tests next to the code it changes. The tests use
generic data only. The structure audit and the three prompt contract tests pass. The package type check
fails only on the other worker's new `result-verification/agreement/tests/reask-split-no.test.ts`.

## What changed and why

### 1. A whole test the working time cannot cover is not started

**Where trials are admitted.** Every whole test goes through
`project-agents/supervisor/whole-trial.ts` `AutomationStudioProjectSupervisorWholeTrial.test()`. That
covers the supervisor's `core.test_candidate` and a single-subflow builder's `core.test_subflow`, which
is the judged whole run. The single-subflow path used to build a fresh `WholeTrial` per dispatch
(`dispatch-tool.ts` `singleWholeTrial`). It now uses the run's one instance through a new optional
`context.wholeTest` (`context.ts`), so every test is timed and remembered once. The run in the debug
note was single-subflow, so this path matters.

**The clock.** `supervisor-loop.ts`:
- `AutomationStudioProjectSupervisorClock` gains an optional `now()`. The real clock uses `Date.now`; a
  test clock without `now` falls back to `Date.now`.
- `startClock` now also returns `time: { now, workLeftMs }`, measured against the work deadline (the
  bound less the ending reserve). It reports 0 once the work signal has fired.

**The rule.** Each finished test is timed, per digest and build-wide. A test is refused with
`project.trial_out_of_time` when the working time left is less than the estimate plus a margin:
- The estimate is the same digest's latest finished test, or for a Flow never tested, the build's latest
  finished test.
- The margin is the larger of 20% and 10 s.

Nothing measured yet, or no clock, starts the test as before.

**What the model is told.** The refusal carries `said`, `workLeftSeconds`, `lastTestSeconds` and
`sameFlow`. Its instruction reads like this:

> "About 2.5 minutes of this build's working time is left, and the last whole test of this same Flow took
> about 5.5 minutes, so this test could not finish before the build's time limit and was not started."

It is followed by the new generic `GUIDANCE.refusals.outOfTime` (`guidance.ts`): do not test again or
change the Flow for speed; end honestly now with `ended`; the latest assembled Flow is kept as a draft and
the person is told what its last finished test answered; complete instead if a yes stands.

**The builder's terms.** `single-subflow-trial.ts` `refusalOf` maps the new code to `said` plus
`WORDS.outOfTime`: nothing ran; do not test again or change the subflow; end the brief partial; the last
finished test stands.

### 2. The ending reports the latest finished test of the same Flow

**Remembered per digest.** `whole-trial.ts` keeps each digest's latest finished test (its revision and
duration), and whether a test the deadline cut came after it. A test counts as cut when `gate.test`
throws while its signal is aborted. This is exposed as `lastOfFlow(digest)`.

**The outcome.** In `supervisor-loop.ts` `done()`, when the latest revision has no verdict of its own,
the outcome gains:
- `sameFlowTrial`: `gate.standing` of the earlier revision with the same digest. A yes is never used.
- `trialCut: true`: a test the deadline cut came after it.

**The draft.** In `service/project-build/run.ts`, an ended draft whose own trial is missing now stands
on `sameFlowTrial`. A time-limited draft adds `project.build_trial_cut` beside `project.build_time_limit`
in `feedback.endingCodes`, and its row passes `cut`.

**The words moved.** `timeLimitWords()` now delegates to a new
`activity/wording/time-limit-told.ts` `automationStudioActivityTimeLimitTold`. The function was private,
reachable only through a full service build; it moved to where Core's other person-facing ending words
live, and its existing wording is unchanged. New wording:
- cut after a finished test: "...its last finished whole test could not be confirmed; a later test of it
  was cut short by the time limit. It is kept as a draft..."
- cut with none finished: "...its test from its start was cut short by the time limit before it
  finished..."

**Promotion.** `service/candidate-trial/promotion.ts` now checks the digest first. A non-yes standing of
the same digest at an earlier revision keeps its own code (for example `candidate.trial_unconfirmed`)
instead of `candidate.trial_stale_revision`. A yes for another revision is still stale and never
promotes.

**The chat.** `conversations/commands/build.ts` `automationStudioConversationCandidateDraftSaid`: when
the codes include `project.build_trial_cut`, it says the last finished test's verdict and that a later
test was cut short by the time limit. With `not_tested`, it says the test was cut short before it
finished. Without that code, the wording is unchanged.

### 3. No "Your Flow is ready" for a draft

`activity/build.ts` `withAutomationStudioBuildActivity` was the emitter; the text matched and there is
one caller, `service.ts` `generateFlowBootstrapAdaptation`. It now checks the result by shape:
- A result with `status: "draft"` emits a final `failed` event, "Build ended: no Flow was built", with
  the text "What it wrote is kept as a draft, and nothing was put into the Flow."
- Thrown builds were already `failed`.
- Proposals keep "Your Flow is ready".

## Commands run and observed results

All runs were from `packages/fluxiq` unless noted.

**Affected test folders.** `npx vitest run` over `activity/tests`, `activity/wording/tests`,
`conversations/commands/tests`, `service/candidate-trial/tests`, `project-agents/supervisor/tests` and
`project-agents/single-subflow/tests`.
- Result: 96 files, 821 passed, 1 failed.
- The failure: `service/candidate-trial/tests/run.test.ts` "the real build-test judge: a yes then no
  gives ['yes','no']" expected 2 judge calls and got 3.
- That is the split-no re-ask the other worker adds in `result-verification/agreement`. It touches no
  file of mine, and that worker has since modified `run.test.ts`. I did not re-run that file.

**Project-build tests.** `npx vitest run src/.../service/project-build/tests`: 19 files, 87 passed.

**After merging the new time tests into `whole-trial.test.ts`.** `npx vitest run` on
`project-agents/supervisor/tests/whole-trial.test.ts`,
`project-agents/single-subflow/tests/single-subflow-trial.test.ts`,
`llm/deepseek/tests/system-prompt.test.ts`, `flow-bootstrap/plan/tests/extraction-vocabulary.test.ts`
and `flow-bootstrap/plan/tests/issue-feedback.test.ts`: 5 files, 84 passed.

**Type check.** `pnpm --filter ./packages/fluxiq check`: exit 2, with 2 errors, both in
`result-verification/agreement/tests/reask-split-no.test.ts` (TS2379 at 77:71, TS2375 at 83:73). That is
the other worker's new file. There were no errors in any file I changed.

**Structure audit.** `node scripts/structure-audit.mjs` (repository root):
- First run: 2 violations, both mine and both fixed. `project-agents/supervisor/tests/` had 26 files;
  I merged the new test into `whole-trial.test.ts`. Two lines in `single-subflow-trial.test.ts` packed
  two statements each.
- Re-run: "structure-audit: passed (407 warning(s), 1152 baselined)".
- `supervisor-loop.ts` is now 455 lines (it was 431), still under the 400-line advisory warning only.

**Tests added.**
- `whole-trial.test.ts`, 7 new cases:
  - refusal measured from the same Flow;
  - estimate from the build's latest test;
  - a test that fits with its margin is started;
  - inside the margin is refused;
  - no clock behaves as before;
  - `lastOfFlow` with a cut after a finished test;
  - a cut with none finished.
- `single-subflow-trial.test.ts`, 2 cases: the builder-terms refusal; the outcome's `sameFlowTrial`
  when the latest revision went back to a tested Flow.
- `time-limit-told.test.ts`, 4 cases.
- `candidate-endings.test.ts`, 3 cases.
- `promotion.test.ts`, 2 cases.
- `scope.test.ts`, 1 case (no "ready" for a draft).

## Not verified

- **Chat wiring.** No service-level test runs a project build whose re-test is cut or refused all the
  way to the chat. Each link is tested on its own: the supervisor outcome, the `run.ts` words through
  `time-limit-told`, promotion codes, and chat words.
- **No standing trial.** A time-limited draft with no finished test at all still reaches the chat as
  `not_tested` / "never test-run". `run.ts` returns no trial, so promotion carries no ending codes. The
  limit's activity row does say the test was cut. Fixing this needs promotion or `service.ts` to carry
  ending codes without a standing trial; I left `service.ts` alone.
- **Candidate mode.** Non-project builds use their own gate and stall retest. No time admission was
  added there.
- **Downstream.** I did not check how the extension renders a `failed` final event for a draft. No Lab
  or browser run was made.
- **Full suites** (`pnpm test`, `pnpm build`) were not run, per the narrow-check rule.

## Open questions or contradictions found

- **Refusal order.** The time refusal is checked before the gate's own refusals (stale revision,
  unchanged after no). Near the deadline, the model sees "out of time" even where the gate would have
  refused for another reason. Ending honestly is still the right advice there.
- **The other worker's open items.** The other worker's agreement change makes yes-then-no judge cases make
  3 calls. Fine, but it also put two new type errors in the package check; the supervisor should
  confirm that worker resolves them before merging.
