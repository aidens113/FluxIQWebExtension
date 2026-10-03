# t195-w37: no progress is not "not doable" (lane D, round 1002-M, cause R11)

## Outcome

Partial. All four items are implemented and tested inside the owned files. The tree is in Core
`C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ` on branch `task/t195-live-control-flow`, uncommitted.

One piece is still missing, and it blocks shipping. The new ending kind `not_finished` is published under a new failure
code, `flow_bootstrap.build_not_finished`, which must be registered in files I do not own. Until it is, a not-finished
build's diagnostic fails Core's own parse and is replaced by a generic `flow_bootstrap.provider_output_validation_failed`.
I saw this happen in the service tests (see below). A ready patch is at
`C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/d8981cea-6a94-4f33-aad3-ede8bc7656e3/scratchpad/w37-registrations.patch`.
`git apply --check -v` passes on it from the Core root. Apply it before merging.

## What changed and why

R = `packages/fluxiq/src/programs/automation-studio/runtime`.

1. **"Not doable" only when there is no way left** (`R/flow-bootstrap/unfinished-build/phases.ts`, `contracts.ts`, `judgement.ts`, `not-doable.ts`)
   - The judge's `stillAchievable` was not carried through the judgement. It now is: an optional
     `stillAchievable` field on the `no` verdict and on `AutomationStudioFlowBootstrapJudgedWrong`, and `judgedWrong()` copies it.
   - The only no-way condition kept is `judgement.judge.verdict === "no" && stillAchievable === "no"`. It ends `not_doable` with
     `noRoute: { kind: "judged_unachievable" }`, worded "...and the last attempt ended when the judge found that what you asked
     can no longer be done." No other code path produces not_doable any more.
   - The no-progress stop (was phases.ts:401) and the repeated-unchanged stop (was :399) now end
     `{ notFinished: StoodStill }`. That produces the new ending from the new file `not-finished.ts`, kind `not_finished`.
   - The not-finished message:
     - opens "I have not finished this Flow yet: <what stood still>";
     - then "What the judge says is left to change: "<advice>"";
     - then progress, test and tried sentences;
     - ends with the kept sentence.
   - It never says "found no way".
   - `contracts.ts`: `NoRouteLeft` is now `{ kind: "judged_unachievable" }`. The new `StoodStill` type is
     `no_progress {before, rounds} | repeated_unchanged`.

2. **One more round** (`phases.ts`)
   - `unprogressed` counts rounds in a row without measured progress, and it resets on progress or on an empty Flow.
   - `judgedFixNamed()` holds when the verdict is `no`, `stillAchievable` is not `no`, and the advice is not empty.
   - After a round without progress, one more round opens only when `judgedFixNamed()` holds. A second round without progress
     in a row ends the build not finished.
   - That extra round still goes through the existing `exhaustedForNextRound()` / `maxRounds` gates, so t240's money rule is unchanged.
     A purse that cannot fund the extra round ends `budget_exhausted` `cost`.

3. **"The judge found the same as before"** (`not-finished.ts`, `judgeSaid`/`sameFindings`)
   - This is said only when the set of finding codes and the whitespace-folded advice are both unchanged.
   - Otherwise the message says `this time the judge found: "<observed or first finding>"`, bounded to 200 characters.
   - The other stood-still clauses moved here unchanged from not-doable.ts.

4. **Plurals and the kept sentence** (`not-done.ts`, `not-doable.ts`, `phases.ts`, new `kept-said.ts`, `budget-exhausted.ts`, `replies-unreadable.ts`)
   - Plurals:
     - `ProgressSaid` with one thing asked now says "The one thing you asked worked when the Flow was run from its start." /
       "...has a step that did not work..." / "...has a step in the Flow, not yet shown to work...".
     - The not-doable checklist clause says "the one thing you asked could not be done".
     - The "Exploring again" announcement says "the one thing you asked is still to do".
   - Kept sentence:
     - What is kept is an incomplete draft beside the Flow. Per `incomplete-draft/index.ts` it is never a Flow and never an
       adaptation, so the Flow itself really is empty.
     - The shared `automationStudioFlowBootstrapKeptSaid` now says "The Flow so far was kept as a draft, not put into the Flow, and
       building again carries on from it[, with $X left of this Flow's $0.10]." That agrees with create-here's "What is left: the
       Flow "...", empty...".
     - The budget, replies-unreadable and not-finished endings use it. provider-unavailable's own wording is left as it was:
       "The steps worked out so far were kept..." does not contradict create-here.

5. **Ending mapping** (`R/flow-bootstrap/generation-failure/build-ending.ts`, the allowed edit, which the mapping needed)
   - New kind `not_finished` mapped to `flow_bootstrap.build_not_finished`.
   - New exported type `AutomationStudioFlowBootstrapEndingRoute`.
   - `tried.noRoute` is now allowed on `not_doable` (`judged_unachievable`, plus legacy `no_progress`/`repeated_unchanged`, so old
     records still parse) and on `not_finished` (`no_progress`, `repeated_unchanged`).
   - `tried.ts` accepts any ending route.

6. **Module headers** updated with run-murwcaj0-40e56557 / run-murz83zy-5030820f as the reason: phases, not-doable, not-finished,
   judgement, budget-exhausted, kept-said, index, build-ending, not-done (doc comment).

Tests:
- New: `tests/no-progress-ending.test.ts` (7 cases) and `tests/not-finished.test.ts` (6 cases, including the count cases moved from
  not-doable.test.ts). `not-doable.test.ts` is rewritten for the judged case and the singular clause, and not-done.test.ts gets the
  "1 of the 1" case.
- Updated to the new behaviour:
  - `judged.test.ts`: the NO verdict has advice, so the build now runs 3 rounds and then ends not finished.
  - `phases.test.ts`, `repair-rounds.test.ts`, `shared-purse.test.ts`, `replies-unreadable.test.ts`.

## Commands run and observed results

All from the Core root.

**Failing first.** `npx vitest run --exclude ".tmp/**" .../unfinished-build/tests/no-progress-ending.test.ts .../tests/not-done.test.ts`
gave `Tests 7 failed | 15 passed (22)`. Each failure was the expected one:
- `expected [...] to have a length of 3 but got 2`
- `expected { kind: 'not_doable' } to match { kind: 'not_finished' }`
- `{ kind: 'not_doable' }` vs `budget_exhausted`
- `Received: "1 of the 1 things you asked worked..."`

**After implementation.** Same scope: all 7 pass. Then the brief's validation command:

```
npx vitest run --exclude ".tmp/**" packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure
```

Output:

```
Test Files  20 passed (20)
     Tests  444 passed (444)
```

Before the old tests were updated, that same command showed 13 failures, all of them assertions pinning not_doable or the old
kept sentence.

**Scoped typecheck.** Not the whole package: the changed files plus reauthor-build.ts and built-loop.ts and their imports,
1487 files. I used scratch `tsconfig.w37.json`, which extends the package config:
`npx tsc -p .../scratchpad/tsconfig.w37.json` printed nothing and exited 0.

**Structure audit.** `node scripts/structure-audit.mjs` gave `structure-audit: passed (225 warning(s), 349 baselined).`

**Outside tests**, narrow and run to show the lead what breaks:

```
npx vitest run ... tests/service-bootstrap/tests/unfinished-build.test.ts tests/service-bootstrap/tests/judged-build.test.ts tests/deepseek-bootstrap/tests/answerability.test.ts activity/tests/scope.test.ts
```

Result: `Tests 3 failed | 23 passed (26)`. Twice the failure was `expected 'flow_bootstrap.provider_output_valida…' to be
'flow_bootstrap.not_doable'`, and once a toMatchObject on the ending. Two causes:
- (a) The code is not registered, so the diagnostic falls back to the generic code. The patch fixes this.
- (b) Those tests pin the old not_doable behaviour.

The failing tests:
- `unfinished-build.test.ts` "ends not doable ... when the repair gets no further" (lines ~178-183)
- `unfinished-build.test.ts` "a continuation whose first round ends on repeats ... ends not doable after that one round" (~226-227)
- `answerability.test.ts` "...ends not doable when the repair's Flow is judged the same no" (~139-155)

All three must expect `flow_bootstrap.build_not_finished`, kind `not_finished`, and the "I have not finished this Flow yet:" wording.
For the answerability case, if its verdict carries advice, the build also takes one more round. `judged-build.test.ts:263`
(`toContain("The Flow so far was kept")`) still passes, because the new sentence keeps that prefix.

`git apply --check -v w37-registrations.patch` checked all 5 files with no error.

## Not verified

- I did not apply the registration patch or run the tests with it applied, because those files are outside my ownership.
- No whole-package typecheck and no full suites were run, as the brief said.
- No live run.
- The producer side is not done:
  - `R/result-verification/build-test/judge.ts` and verify's repair judgement (`result-verification/contracts.ts:402`,
    `verdict.ts`) do not carry the diagnosis's `stillAchievable`.
  - Until that worker threads it into the `no` verdict, `stillAchievable` is always absent (unknown). In practice that means:
    no build ends not_doable; a judge with advice buys one extra round; and the rest end not_finished.
  - This matches the user's rule, but the not_doable path is only exercised by unit tests until the field is threaded.

## Open questions or contradictions found

1. **Registration needed outside ownership.** The patch above does all of it:
   - `generation-failure/codes.ts`: add `flow_bootstrap.build_not_finished` to the provider_output_validation list.
   - `failure-state.ts`: add it to `ENDING_CODES` and to the retryable set, since a retry continues the kept draft.
   - `diagnostic.ts`: doc comment.
   - `activity/build.ts`: `ENDING_TITLES.not_finished = "Build stopped: the Flow is not finished yet"`. Without it the chat title
     falls back to "Build failed".
   - `generation-failure/tests/round-trip.test.ts`: the ENDINGS list.
2. `service/flow-bootstrap-commands/built-loop.ts:30` calls `creation.ended(kind === "not_doable")`. A not_finished build therefore
   keeps the Flow creation's purse open, so building again carries on with what is left. That is consistent with the kept
   sentence, but confirm it is intended.
3. `tried.noRoute` now also appears on `not_finished` records, and a new value `judged_unachievable` exists. The Lab's
   publishable-tree copy (`packages/test-runner/.../decision-trace`) copies `noRoute.kind` as a stop word. Check that it accepts
   the new value.
4. The brief's line numbers (phases.ts:399/401) refer to the HEAD file: the stops were at those lines.
