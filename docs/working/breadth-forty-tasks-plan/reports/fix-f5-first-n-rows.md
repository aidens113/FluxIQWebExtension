# Fix F5: act on only the first N rows (`repeat over` + `repeat most`)

Worker report, 2026-10-19. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t567/!FluxIQ`, branch
`task/t567-a8-lane-4b`. Nothing committed.

## Outcome

Partial. Every owned part is done and tested. A step that says `repeat over: <rows>` and `repeat most: N`
now builds a For Each with a new `stopAfter: N` option: the loop acts on the first N rows, in order, then
finishes successfully. The safety limit (`maxIterations`) still fails the run as before. A Flow without the
option behaves exactly as it did.

The exact script from photo r1 is still refused, by a file I do not own. That script repeated
`repeat over: posts` + `repeat most: 3` on each of three adjacent steps. After `adjacent-list-repeats.ts`
merges those into one span, the bound left under the second and third steps is refused by
`script-statements/repeat-bound.ts` as `flow_script.repeat_most_misplaced`. That module only knows
`repeat while` spans. I checked this with a scratch test, since deleted. The same script with the bound
written once, on the first step, is accepted and gives For Each `stopAfter: 3` across all three steps.
See "Open questions".

## What changed and why

- `packages/fluxiq/src/programs/automation-studio/nodes/control-flow/for-each.ts`
  - New parameter `stopAfter` (label "Stop after"): number, no default, integer, 1 to 10,000.
  - On the first pass the node keeps only the first `stopAfter` items. It slices the list, so each element
    is still the same object. It checks the safety limit against the items it will actually take, then
    walks them and routes `done` as success. `count` is the number of items taken.
  - An unset, `null` or empty `stopAfter` takes every item, so saved Flows behave as before.
  - Why the limit counts taken items: a long feed cut to 3 rows should not fail the 100-item limit. A
    `stopAfter` above the limit, on a list longer than the limit, still fails with
    `for_each.max_iterations_exceeded`.
  - Header comment explains how the two bounds differ.
  - The kept iteration state holds the sliced list, so a resumed run continues on the same rows: the
    `graph-run.ts` seed copies `items`.
- `.../runtime/flow-bootstrap/authoring/draft-routing.ts`
  - `scriptSpan` no longer refuses `repeat most` beside `repeat over`. Over a listing it is checked
    against For Each's `stopAfter` limits, read from the registry, and carried on the span.
  - Over a step that reads no list (a check), it is refused with `flow_script.repeat_invalid`.
  - `emitRepeatOver` writes it as the For Each step's `stopAfter` entry.
  - The `repeat while` bound check now shares the same helper, `writtenBound`; its behaviour and wording
    are unchanged.
  - The file is now 797 lines; the hard limit is 800. The `authoring/` directory already holds 25 files,
    the directory cap, and nesting a folder inside it would break the path-depth limit. So no new module
    could go beside it. The next change to this file will need a split.
- `.../runtime/flow-bootstrap/plan/flow-script-format.ts`
  - One clause added to the `repeat most:` line: "Beside `repeat over:` it acts on only the listing's first
    rows, in their order, and then the Flow goes on: `repeat over: bookmarks` then `repeat most: 2` does the
    span for the first two bookmarks."
  - Short history note in the doc comment. The example is generic (bookmarks) and names no realistic
    scenario's content.
- Tests:
  - `nodes/control-flow/tests/for-each.test.ts`: the option is declared with no default; the loop stops
    after N and finishes on `done`; a list shorter than N; N written as text; unset, `null` or empty walks
    every item; the safety limit counts the items taken (150 rows with stop 3 runs, with stop 120 it fails).
    The existing limit tests are unchanged and pass.
  - `authoring/tests/candidate-loops.test.ts`, new describe "lane D on the first rows only":
    - The pairing assembles; For Each's parameters are the unbounded ones plus `stopAfter: 2`.
    - Edges and node kinds are identical to the unbounded loop.
    - The plan validates and the written-plan checks are clean.
    - Without `repeat most`, `stopAfter` is absent.
    - `lots`, `0`, `2.5` and `10001` are refused as `flow_script.repeat_invalid @ flow.line.13`.
  - `plan/tests/loop-format.test.ts`: the clause is present and contains no photo, like, post or newest
    wording.

Tests first: the two new `candidate-loops` tests failed before the `draft-routing.ts` change: the old
"repeat most beside repeat over" refusal, and a missing `stopAfter`. They pass after it. For `for-each.ts`
I wrote the tests and the code in the same step, so I did not see that file's new tests fail first.

## Commands run and observed results

All run from `C:/Users/osrs_/FluxStuff/fxwork/t567/!FluxIQ`. Tests ran from `packages/fluxiq`.

- `npx vitest run src/programs/automation-studio/nodes/control-flow/tests/for-each.test.ts`: 1 file, 17 tests
  passed.
- `npx vitest run .../authoring/tests/candidate-loops.test.ts` before the routing change: 2 failed, 18 passed.
  The failures were the expected ones: the old refusal, and the For Each parameters.
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/ .../authoring/tests/ .../script-statements/tests/ src/programs/automation-studio/nodes/control-flow/tests/`:
  60 files, 551 tests passed.
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/`: 2 failed, 236 passed.
  - The 2 failures are already on HEAD:
    - `extraction-vocabulary.test.ts`: "expected 4394 to be less than or equal to 4000".
    - `issue-feedback.test.ts`: a `recordOutput` deep-equal mismatch.
  - To confirm, I temporarily restored HEAD's `for-each.ts`, `draft-routing.ts` and `flow-script-format.ts`
    and ran those two files: the same 2 failed, with the same 4394. I then put my versions back; the working
    tree diff is the same 6 files.
- `pnpm --filter ./packages/fluxiq check`, which runs `tsc --noEmit`: exit 0.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (405 warning(s), 1152 baselined).`

## Not verified

- No graph-level replay test of a saved Flow with `stopAfter`, through `executor/graph-run.ts` or a parked
  and resumed run. The executor tests folder is not mine. Replay rests on two facts: the node reads its saved
  `parameterValues`, and the seeded loop state copies the sliced `items`.
- The refusal of `repeat most` beside `repeat over` a check step (one that reads no list) has no test.
- The drafted, amend-draft path is not covered: `AutomationStudioFlowDraftRepeatOverRouting` in
  `runtime/flow-draft/routing.ts` has no `most`. Only the script path, which candidate builds use, gains the
  bound.
- No browser, live or paid run, and no whole suites, as the brief asked.

## Open questions or contradictions found

1. **Needs another owner to fix photo r1's exact script:**
   `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/script-statements/repeat-bound.ts`
   and its tests. Proposed change:
   - `whileSpans` should also return `repeat over` spans: the head says `over` and no `while`, and the end
     is its `repeat through:` label or the head itself.
   - A `repeat most:` written under a member of such a span then moves onto the head, as it does for
     `while` spans.
   - A member bound equal to the head's own bound should be dropped quietly rather than refused, since photo
     r1 repeated `3` on every member. Different values stay refused.
   - The `MISPLACED` sentences should name `repeat over:` as well as `repeat while:`. Today the refusal
     tells the model to write the bound "beside the `repeat while:` line", which is wrong for this case.
   - `adjacent-list-repeats.ts` already keeps a member's `most` for exactly this hand-off, so it needs no
     change.
2. **`draft-routing.ts` is at 797 of 800 lines, and `authoring/` is at its 25-file cap.** The supervisor may
   want a split, for example moving the repeat-over and repeat-while emitters into a sibling directory, the
   way `script-statements/` sits beside `authoring/`.
3. **Two plan tests fail on HEAD of this branch, independent of F5:** `extraction-vocabulary` (prompt size
   4394 > 4000) and `issue-feedback` (`recordOutput` shape).

## Continuation (2026-10-19): bound repeated on each step, the drafted path, and the replay test

The coordinator gave me two more files: `script-statements/repeat-bound.ts` and `runtime/flow-draft/routing.ts`,
plus the tests beside them, and asked for a For Each replay test. That brief named
`runtime/flow-bootstrap/flow-draft/routing.ts`. The file is actually at
`runtime/flow-draft/routing.ts`, and that is the one I changed.

### Outcome

Done for all three items. The exact shape photo r1 wrote is now accepted as one span with For Each
`stopAfter: 3`: three adjacent steps, each with `repeat over: <rows>` and `repeat most: 3`.

### What changed and why

- `script-statements/repeat-bound.ts`
  - The span reader (renamed from `whileSpans` to `repeatSpans`) now also lists `repeat over` spans: their
    first step and the step their `repeat through:` names. So a `repeat most:` written under any step of
    such a span is moved onto the span's first step, as it already was for `repeat while` spans.
  - A bound equal to the one the span already has is dropped, not refused. This applies to both kinds of
    span, so a `repeat while` span that repeats the same bound is accepted too.
  - Two different bounds on one span are still refused as `flow_script.repeat_most_misplaced`, at the second
    bound's line; the message names both lines.
  - The "bounds nothing" refusal now says `repeat while:` or `repeat over:`.
  - `repeat most` beside a `repeat over` of a step that reads no list is refused in
    `authoring/draft-routing.ts` as `flow_script.repeat_invalid`, "which reads no rows to take the first
    of". I kept the existing codes because `plan/issue-feedback.ts` lists the codes whose messages the model
    is shown, and that file is not mine.
- `runtime/flow-draft/routing.ts`: a drafted repeat over a step may now carry `most?: number` (it was
  `most?: never`). The doc comment explains the meaning.
- `authoring/draft-routing.ts`
  - The drafted `repeat()` passes `most` to `emitRepeatOver`. Drafted and written loops are built by that
    same function, so the two paths produce the same graph.
  - A drafted `most` over a check (a step that reads no list) is refused as
    `flow_draft.repeat_not_after_its_source`. I first used a new code. The candidate refusal corpus, which I
    do not own, requires every code the authoring source raises to be covered there, so I reused this
    existing drafted-repeat code instead.
  - The file is now 798 of 800 lines. No split.
- Tests:
  - `script-statements/tests/repeat-bound.test.ts`:
    - The photo shape gives one For Each with `stopAfter: 3`.
    - A bound under a later step alone bounds the span.
    - With no bound, there is no `stopAfter`.
    - Different bounds (3 and 4) are refused, naming both lines.
    - A bound beside a repeat over a check step is refused as `repeat_invalid`.
    - An equal bound repeated on a `repeat while` span is accepted.
    - The existing message assertion was updated to the new wording.
  - `authoring/tests/candidate-loops.test.ts`:
    - A drafted repeat over a list with `most: 2` builds the same nodes and edges as the written
      `repeat most: 2`, with `stopAfter` 2.
    - A drafted `most` over a check is refused with the message above.
  - `runtime/executor/tests/graph-run.test.ts`:
    - A Flow document with For Each `stopAfter: 2` is round-tripped through JSON and run with
      `runAutomationStudioGraph` over 5 items.
    - The For Each attempts route body, body, then done (count 2), only the first two rows are recorded, and
      the run reaches End with status succeeded.

Order of work: the repeat-bound tests failed first (5 failed, 5 passed), then passed after the fix. The two
drafted tests failed first (2 failed), then passed. The graph-run test passed when first run, because
`for-each.ts` already had the option; it guards against regressions.

### Commands run and observed results

- `npx vitest run` over these folders:
  `.../flow-bootstrap/candidate/tests/`, `.../authoring/tests/`, `.../script-statements/tests/`,
  `.../nodes/control-flow/tests/`, `.../runtime/flow-draft/tests/` and
  `.../runtime/executor/tests/graph-run.test.ts`.
  Result: 83 files, 813 tests passed.
  - Before I switched to the existing code, the corpus test "are each met by a corpus case..." failed on the
    new code.
- `npx vitest run .../flow-bootstrap/plan/tests/`: 236 passed, 2 failed. These are the same 2 failures that
  are already on HEAD (`extraction-vocabulary` 4394 > 4000, and `issue-feedback`).
- `pnpm --filter ./packages/fluxiq check`: exit 0.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (405 warning(s), 1152 baselined).`

### Still not verified, and owners still needed

- **A build model still cannot set `most` on a drafted repeat over a list through `amend_draft`.** Four places
  block it, none of them mine:
  - `runtime/flow-draft/amendment/route.ts` drops `most` for an over repeat.
  - `amendment/schema.ts` says "repeat with while only" and caps `most` at 500.
  - `runtime/llm/evidence-loop-decision.ts` (line 624) rejects `most` without `while`.
  - `flow-draft/entry.ts` `routingLine` does not print `most` for an over repeat.

  Candidate builds author scripts, so the photo path does not depend on these.
- **Neither the dry run nor reading a saved Flow back as a draft knows the bound.**
  - The dry run (`flow-draft/dry-run.ts`, `llm/node-tools/dry-run-gate.ts`) still replays a drafted repeat
    over every row, not only the first N.
  - Reading a saved Flow back as a draft (`llm/node-tools/draft-from-flow.ts`) does not carry For Each's
    `stopAfter` into the draft's routing.
- Not tested: a parked run that resumes mid-loop with the cut list (the seeded `items`).
