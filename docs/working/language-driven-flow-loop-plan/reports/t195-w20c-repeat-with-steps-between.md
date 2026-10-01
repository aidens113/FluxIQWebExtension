# t195-w20c: a loop whose listing is not the step right before the act

## Outcome

Done. A `repeat` over a list now builds when kept steps (a dismissal, a rerun, an optional step's join) sit
between the listing and the span. Those steps run once, before the loop. The F7 waited retry passes end to end
through For Each with no executor change: 11,500 ms was asked for and the same row was pressed again.

## What changed and why

Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/draft-routing.ts`, `repeat()`:

- The adjacency rule (`overAt !== input.index - 1`) is gone. A refusal now happens only when `overAt >= input.index`.
  Its message names the list step and says to move it ahead with a reorder. The "say repeat with no over" advice is
  removed: that advice made a dismissal the loop's source (audit B2).
- `source` is the `over` step's emitted entry, found by label. It is `undefined` when `over` was consumed by another
  construct (a recovery, an earlier loop's body) or has no emitted entry. That case keeps the
  `repeat_not_after_its_source` refusal, with a message naming the step.
- `head` is the last emitted entry. When `source === head`, the wiring is exactly as before
  (`[success -> loop:branches, rows -> each:items]` on the head, which is routed).
- When `source !== head`:
  - `source` gains only `branch(rows, each, "items")` and stays unrouted, so it still falls through to the next step.
    Observed in the test: `list:success -> dismiss:in`.
  - `head` gains `branch("success", loop, "branches")` and `routed = true`.
- **A decision beyond the spec.** A check loop (an `over` step with no list output) still needs its check
  immediately before the span. It now gets its own message naming the check step. The check is lifted into the loop,
  so lifting it over steps written after it would run those steps before the check. The spec covers only the list
  case, and this keeps the harmful while-loop from forming.

New test file `.../flow-bootstrap/authoring/tests/repeat-loop.test.ts` (6 tests). I made a new file because
`draft-routing.test.ts` is already at 409 lines, past the advisory threshold.

1. `[read d1, press d2, press d3 repeat over d1 through d3, read d4]` builds. Full role wiring is asserted:
   - `web.output.dom-extract_list:records -> builtin.control.for-each:items`;
   - `dismiss:success -> loop:branches`;
   - `list:success -> dismiss:in`, with that the dismissal's only way in;
   - `each:body -> act:in`, `each:item -> act:item`, `act:success -> loop:branches`;
   - `each:done -> exit:in`, `exit:success -> after:in`.
2. The same draft with d2 `optional` builds. Node order is `list, dismiss, join, loop, each, act, exit, after`, and
   `join:success -> loop:branches`.
3. `validateAutomationStudioFlowBootstrapPlan` accepts both drafts (`ok: true`, no errors).
4. A graph run of draft 1 with 3 rows:
   - the dismissal is clicked once with no row, then the act once per row with that row;
   - the list read runs twice (the listing, then d4);
   - the run succeeds.
5. Extra: a listing written after the span is refused. The message names step 2 and no longer contains "no over".
6. F7 (audit R3):
   - Setup: a 4-row loop. The native click returns `{code: "web.action.rate_limited", category: "action_failed",
     retryable: true, stage: "execution", effect: "unacted", retryAfterMs: 11_500}` on pass 4's first press.
   - Assertions:
     - the run succeeds;
     - the click attempt statuses are `[succeeded, succeeded, succeeded, failed, succeeded]`;
     - the last two attempts' `inputs.item` are both row 4;
     - the injected `delay` was called exactly once, with `[11500]`.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/authoring` (in `packages/fluxiq`):
  `Test Files 9 passed (9)`, `Tests 85 passed (85)`. That includes `repeat-loop.test.ts` (6) and the existing
  `draft-routing.test.ts` (16), unchanged.
- Revert check:
  - I saved my `draft-routing.ts` to the scratchpad, wrote `git show HEAD:` over it, and ran `repeat-loop.test.ts`:
    `Tests 5 failed | 1 passed (6)`.
  - Tests 1, 2, 3 and 4 failed, and so did the refusal-text test. Only F7 passed, as expected: it does not depend on
    the change.
  - I then restored my version. `git diff --stat` shows `draft-routing.ts | 24 ++++++++++--` again.
- `bash .../heavy.sh "t195-w20c tsc" npx tsc --noEmit -p tsconfig.json`: exit 2.
  - All 5 errors are in `runtime/flow-bootstrap/instructed-acts/checklist.ts` (lines 102, 110, 111, 142, 148:
    TS2554 "Expected 5 arguments, but got 4", and TS2322 `"span_stops_short"` not assignable to
    `AutomationStudioInstructedActTodo`).
  - That is w20d's file, mid-edit. There are no errors in any file I own. The first run's `exit=0` was the pipe's
    `tail` and is disregarded.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (206 warning(s), 353 baselined)`. The new
  file draws no warning.
- I grepped `fxwork/t195` for the old refusal text. Nothing else quotes it.

## Not verified

- Anything live: no Lab, browser or model call.
- A listing that is itself `optional` or `only_if`-guarded, with steps between. It builds (`source` keeps its
  `failed -> join`), but if the listing fails, For Each is entered with no `items`. What the executor does then is
  untested.
- Two loops over the same listing (`over` is not consumed, so a second span may name it). This now builds with two
  `records` edges from one port. It is not tested and not validated.
- The full `flow-bootstrap` suite and any suite beyond the authoring directory: none were run, per the user rule.

## Open questions or contradictions found

- The check-loop case (above) keeps an adjacency refusal, with new wording. The lead may want a different answer,
  such as moving the check after the steps between.
- The header comment of `draft-routing.ts` still lists "a span that is not contiguous" among the refusals. That is
  still true of the span itself, so I left it.
- The F7 path needed no fix:
  - `defensive/assess.ts` reads `retryAfterMs` off the failure record (via `retry-hint.ts`);
  - `effect: "unacted"` lets the mutating click repeat;
  - `retry-wait.ts` bounds 11,500 ms under the 30 s per-attempt cap.
