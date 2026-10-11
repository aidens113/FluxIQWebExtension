# t443: a repair rerun redoes the earlier steps first, and the judge sees a real landing

Worker report. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t443/!FluxIQ`, branch
`task/t443-repair-rerun-place-and-judge-evidence`. Nothing committed. The downstream worktree is unchanged
apart from this report.

## Outcome

Done. Fixes 1 and 3 of `r4b-withheld-act-judge.md` are in. Fix 2 is not implemented, and D1 stays.

- A rerun of a seeded step now does the seeded steps before it on its page again first.
- A lasting act whose earlier steps cannot be done again is not pressed. The rerun is answered
  `rerun_place_unreachable` with `lastingAct: true` and `unknownBefore: <position>`.
- The judge's `explored` now reports a landing held in `priorExecution`, or on a rerun's own record. It is
  credited only when the press ran after the steps before it.

## Supervisor review change (positive evidence for lasting presses)

This section supersedes the lasting-act rule described under "What changed" below, and closes the risk
named under "Not verified".

**The design.** A rerun of a lasting act no longer compares page tokens at all. The supervisor's literal rule
was "refuse when a token does not compare equal". That rule would still need a comparison to decide which
steps belong to "this page". It would also refuse every repair whose Flow starts on another page, such as
any Flow that opens with a navigation. So the comparison is removed from the lasting path.

`llm/node-tools/step-place.ts`:
- **When the lasting path applies.** `pressesLastingAct` is true when the act has not landed
  (`ActDone` is false) and either:
  - the step's replay mode is `verify`; or
  - the rerun's own argument declares a lasting consequence (new `value` input; evidence-loop passes
    `decision.input`).
- **What the lasting path does** (`lastingActPlace`):
  1. It resets to where the Flow's first proposed step starts (`startPage: "flow_start"`).
  2. It does every proposed step before the act again, in order, with `reanchor: false`. Carried joins are
     skipped. Earlier lasting steps are checked, not pressed.
  3. It presses only when every one of those steps answered `replayed`, `verified` or `present`, or is a
     step the Flow itself does not always run (routing: optional, interruption, only-if). That one
     exception is mine: without it, a Flow with an absent optional popup step could never press its act.
- **Every other case presses nothing and answers `rerun_place_unreachable` with `lastingAct: true`.** These
  are: no known start for the first step (or for the act itself when it is first), a failed reset, or an
  earlier step that failed or was not sent.
- Non-lasting reruns keep the walk-back behaviour. The shared code is now `putBack`, `redo` and
  `notDoneAgain`.

`result-verification/build-test/landing.ts`: the judge side follows the same rule.
- A `put_back` landing counts only if `redone` covers every proposed step before it (carried joins aside).
- An `already_there` landing counts only when no step comes before it.

New tests, in `step-place-done-again.test.ts`:
- **Spelling test.** The repaired run's token for the session page has no trailing slash, and this
  build's rerun recorded one.
  - When one earlier choice cannot be redone, nothing is pressed (`reserved: []`). The only reset goes
    to the Flow's start, never to the rerun's own token.
  - When every earlier step is redone, the act is pressed once, with the chosen values. Again the only
    reset is to the Flow's start.
  - Before this change, that input pressed after a reset to the rerun's own token, with nothing redone.
- The seeded redo now runs from step 1: the reset, then f1 to f5, then the reserve.
- An unknown start for the Flow presses nothing (`unknownBefore: 1`).

New tests, in `landing.test.ts`: a put-back that left steps 1 and 2 out is flagged, and so is
`already_there` with steps before it.

Re-validation, run after all edits:
- `tsc --noEmit -p .` printed `TSC_EXIT=0`.
- `vitest run` over llm/node-tools/tests, result-verification/build-test/tests, llm/tests,
  llm/evidence-loop/tests, flow-draft/tests, result-verification/tests and
  service/flow-bootstrap-commands/tests printed `Test Files 151 passed (151)` and `Tests 1720 passed (1720)`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (329 warning(s), 1159 baselined).` The
  extra warning is step-place.ts at 461 lines, past the 400-line advisory. The hard limit is 800.
- `evidence-loop.ts` is still exactly 800 lines.

Remaining limits:
- A lasting rerun now replays the whole prefix from the Flow's start, so it makes more host calls.
- It also needs `nodeOf` for seeded steps, as before.
- An earlier lasting step without a declaration, in a build with no `lastingActs`, is pressed again during
  the redo. This is the same exposure the dry run has.

## What changed and why

All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `llm/node-tools/step-place.ts`
  - `startedOn` is replaced by the whole `seedStartedOn` map. Every step's place, the rerun's own and each
    earlier one's, is `replay?.from ?? seedStartedOn[standsFor ?? id]`.
  - `stepsBefore` walks back on that place. It reports `unknownBefore` when it stops at a proposed step that
    has no known place.
  - The lasting-act rule (fix 1, second sentence of the brief) applies when the step's replay mode is
    `verify` and its act is not yet done (`automationStudioFlowDraftStepActDone` is false). The rerun is then
    unreachable, and nothing is reset or pressed, in either of these cases:
    - the walk met a step with no known place;
    - the step itself has no place and a proposed step comes before it.
  - `put_back` places carry `unknownBefore`. For a non-lasting rerun, the model's `rerunPlace` note gains a
    `notDoneAgain` sentence.
  - New export `automationStudioNodeRerunPlaceOfStep(place)` gives the record kept on the step.
  - New `nodeOf` and `definitionOf` inputs are passed to `automationStudioFlowDraftReplaySteps`.
    - Without them, a seeded step (a scheduled candidate) builds no call and fails
      (`replay-span.ts:325`). The redo would then never run.
    - The R4b report left this unverified. Tests confirm the redo needs these inputs.
- `llm/evidence-loop.ts`
  - Passes `input.draft.seedStartedOn`, `input.nodeOf` and `input.definitionOf` to step-place.
  - Records `rerunPlace` on the step a rerun leaves, through `draftRecord`, unless the rerun was a check.
  - The file is held at exactly 800 lines: one `let` was merged and one comment moved inline.
  - This goes past "only the seedStartedOn hand-off", as noted under open questions.
- `flow-draft/step.ts`: new optional field
  `rerunPlace?: {kind:"put_back"; redone: string[]; unknownBefore?: number} | {kind:"already_there"} | {kind:"start_page_unknown"}`.
  It is a type only and was not in the brief's file list.
- `llm/node-tools/rerun-check.ts`
  - A check that takes now deletes `step.rerunPlace` from the candidate. The press's place stays in
    `priorExecution`, which is cloned before the deletes, as is its `changed` and its states.
  - Header paragraph on keeping the press's evidence.
- `result-verification/build-test/landing.ts` (new, exported by the barrel) holds
  `automationStudioBuildTestExplored`, which replaces summary.ts's private `explored()`. The press is
  `priorExecution`, or the step itself when it has a `rerunPlace`. It counts when:
  - it was `put_back` with every `redone` step still proposed (`after` lists those steps with their words,
    which are the choices it was made with); or
  - it was `already_there`; or
  - it was an ordinary call and no proposed step before it is carried, written, or a checked candidate.

  It is flagged (`counts: false` with `why`, and `pressed` when its words differ) in these cases:
  - `start_page_unknown`;
  - `unknownBefore`, which is R4b's own landing;
  - a redone step that has changed since;
  - another target than the step has now;
  - an ordinary press made after carried steps that had not run.

  A counted landing gives `explored` the press's record (`changed: yes`, its code, `stateChanged`). A flagged
  one leaves `explored` as today.
- `result-verification/build-test/summary.ts` calls the new function and passes it `targetWords`. Its header
  is updated.
- `result-verification/contracts.ts`
  - `explored.landed?: AutomationStudioBuildTestLanding` and the new exported type.
  - It is a type only and was not in the brief's file list.
- `llm/diagnosis-instructions.ts`
  - One sentence was added after "judge it from explored ... and its target." It uses generic words and no
    scenario task:

    > explored.landed, where present, is that act as the build did it earlier: with counts true it ran once
    > after the steps before it -- after names them with the choices they made -- as the step now stands,
    > so it is done and shows the act works with those choices, and never ask for it to be run again; with
    > counts false it did not run that way (why says how), and it shows nothing about the Flow.
  - A source comment records why the sentence is there.
- Tests:
  - `step-place-done-again.test.ts`: four new tests on a seeded workshop Flow (`draft-from-flow` with
    `startPages`, no `replay.from`):
    - the redo order is reset, then the voucher as `verify`, then three choices as `step`, then reserve;
      `reserved: ["Evening / Room B x3"]`, no second voucher;
    - R4b's shape (only the last node has a start page) presses nothing;
    - a lasting step with no page presses nothing;
    - a non-lasting rerun reports `unknownBefore` and `notDoneAgain`.
  - `step-place.test.ts`: moved to `seedStartedOn`.
  - `rerun-check.test.ts`: the press's evidence survives two checks in `priorExecution`.
  - `build-test/tests/landing.test.ts` (new) is the packet-0109 fixture on a generic shop: counted, R4b
    flagged, start page unknown, a changed step, another target, an ordinary press both ways, and the plain
    creation packet unchanged.
  - `llm/tests/diagnosis-channel.test.ts`: the new sentence reaches only the build judge.

## Commands run and observed results

All were run in `packages/fluxiq` of the t443 Core worktree.

- `node_modules/.bin/tsc --noEmit -p .` printed no errors, `TSC_EXIT=0`, on the final run after the last
  edit.
- `node_modules/.bin/vitest run .../llm/node-tools/tests .../result-verification/build-test/tests .../llm/tests/diagnosis-channel.test.ts`
  printed `Test Files 40 passed (40)` and `Tests 438 passed (438)`.
  - After the last landing-test edit, the build-test and node-tools directories were re-run and printed
    `Test Files 39 passed (39)` and `Tests 419 passed (419)`.
- `vitest run .../llm/tests .../llm/evidence-loop/tests .../flow-draft/tests .../result-verification/tests`
  printed `Test Files 90 passed (90)` and `Tests 1178 passed (1178)`.
- `vitest run .../service/flow-bootstrap-commands/tests` (it holds `extend-subject.test.ts`, which uses
  seeded start pages) printed `Test Files 22 passed (22)` and `Tests 121 passed (121)`.
- `node scripts/structure-audit.mjs` (repository root) failed and then passed:
  - First run: `FAIL [file-lines] llm/evidence-loop.ts: 802 lines exceeds the 800-line limit`. Fixed by
    compacting to 800 lines.
  - Second run: `FAIL [statement-packing] landing.test.ts line 34`. Fixed.
  - Final run: `structure-audit: passed (328 warning(s), 1159 baselined).`

## Not verified

- No Lab, provider or browser run, as the brief requires.
- **Place tokens across sources.** The walk compares a step's place whole. A rerun step that already ran in
  this build has its own `replay.from` from the build. The seeded steps before it have their tokens from the
  repaired run's `stateRefs.beforeAction.from`.
  - If the web host's two tokens for the same page are not byte-equal, the walk breaks at "another page".
    That counts as known, not unknown, so a lasting act would be pressed after only the reset, which is R4b
    again.
  - The first rerun of a seeded step compares seeded tokens with each other, so it is unaffected.
  - Worth a check against a real run's tokens, or the domain's `from` shape.
- Only the unit-level `nodeOf` was tested. The real catalog's `outputAction.fixed` was not. A seeded step
  whose node has no fixed output action, or that was changed since it was seeded (no scheduled candidate),
  cannot be done again. It now makes the rerun unreachable.
- The extension worktree was not built or typechecked. Grep finds no downstream use of
  `automationStudioNodeRerunFromItsPlace`, and the `explored` contract change only adds a field.

## Open questions or contradictions found

- **Files outside the brief's list.** The judge has to know where a press ran, and the step had no field for
  it, so these files were also touched:
  - `flow-draft/step.ts`: one optional field;
  - `result-verification/contracts.ts`: the `explored.landed` type;
  - `evidence-loop.ts`: two lines beyond the hand-off (record `rerunPlace`, pass `nodeOf`/`definitionOf`);
  - `build-test/landing.ts` and `build-test/index.ts` (new): summary.ts is near its 500-line budget and the
    one-thing-per-file rule.

  None of these overlap the t442, t444 or t445 files named in the brief.
- **Behaviour change for non-lasting reruns.** A rerun of a seeded read or press now does the seeded steps
  before it on its page again. If one of them cannot be done again, the rerun runs nothing and names that
  step. Before, it ran with nothing redone. This matches the existing rule for built steps, but it is
  stricter for repairs.
- **Ordinary presses.** An ordinary-call press later replaced by a check counts when no proposed step before
  it is carried, written or a checked candidate. Iteration numbers restart each round, so call order across
  rounds cannot be checked. A press made earlier than a later edit of an uncarried step is still credited.
  The only exception is the put-back case, which checks that every `redone` step is still proposed.
- With fix 2 not implemented and D1 kept, a repair whose first rerun press was out of order (R4b) still
  cannot pass honestly. The judge now sees why (`landed.counts: false`, `why`), and the rerun can no longer
  press out of order in the first place.
