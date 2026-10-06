# Report: s2-amend (read-list redesign S2, Core do-while repeat in the draft)

Worker report for brief `s2-amend`. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t283/!FluxIQ`, branch
`task/t283-read-list-s2-loop`. `R` = `packages/fluxiq/src/programs/automation-studio/runtime`. No commits.

## Outcome

Done. A draft can now state, keep and check `{"step": <read>, "change": "repeat", "while": <last>, "most"?: n}`.
The C1 block and `amendment/types.ts` are as the lead wrote them; I built on them and did not change them.

## What changed and why

1. `R/llm/evidence-loop-decision.ts` (`readAmendment` only)
   - The exact-key list now accepts `while` and `most`.
   - `while` is read as a position, like `over`.
   - These cases are left out as malformed: `while` with `over`; `through` and `while` both given and different; `most`
     without `while`; `most` that is not a safe integer from 1 to 500.
   - The amendment it returns carries `while` and `most` when they were sent.
2. `R/flow-draft/amendment/route.ts`
   - A repeat whose amendment carries `while` writes `{ kind: "repeat", through: id, while: id, most? }`, where `id` is
     the id of the step `while` names. A position that names no step is `no_such_step`; a step that is not proposed is
     `not_a_kept_step`.
   - Without `while`, behaviour is unchanged. `already_so` still comes from the existing `same()` JSON comparison, which
     works because the field order is fixed.
   - The doc comment now names the `while` default.
3. `R/flow-draft/routing.ts` (outside the C1 block)
   - `automationStudioFlowDraftRoutingReferences` returns `[through, while]` for a do-while.
   - `automationStudioFlowDraftRepeatOrderProblem` returns only `span_broken` for a do-while (when its `while`/`through`
     stands before the step), and never `over_after`.
   - `automationStudioFlowDraftConditionalStepReasons` no longer counts a do-while span's members as conditional: the span
     always runs once, so a failure there is a real failure.
4. `R/flow-draft/amendment/repeat-revalidation.ts`
   - `automationStudioFlowDraftRepeatRefusal`: a do-while is refused only as a broken span, with `no_such_position`. It
     never reaches the `over` lookup.
   - `automationStudioFlowDraftTakeOffBrokenRepeats`: a do-while that is taken off is reported as
     `{ step, reason: "repeat_taken_off", takenOff: "span_broken", through, now?, throughNow? }`, with no `over` and no
     `overNow`.
5. `R/llm/draft-amendment-feedback.ts`
   - Before this change, a do-while `repeat_taken_off` (no `over`) was told nothing: `next` was `undefined`. The fail-first
     output below shows this.
   - A new private `takenOffWhile`, called from `takenOff` when `over` is absent, now says: "Step N's repeat while step T
     succeeds was taken off: after this decision's moves step T runs before step N, so the span ... no longer holds
     together. It now runs once, in order." It adds the renumbering where the numbers changed, and tells the model to
     resend the repeat on the span's first step with `while` naming its last step.
6. `R/flow-draft/amendment/bind.ts`
   - `insideRepeat` ignores do-while spans, so a `{"$row": ...}` binding inside a do-while is refused
     `bind_row_outside_loop`.
   - A step that is also inside a repeat over a listing still binds.
7. The readers of `routing.over` (the `fluxiq:check` type errors). Each now treats a do-while as having no listing:
   - `R/flow-bootstrap/instructed-acts/checklist.ts` `overOf`: gives nothing for a do-while (guards on
     `routing.over !== undefined`), so the checklist says "does it repeated".
   - `R/llm/evidence-loop/rerun-replacement.ts` `renamed`: for a do-while, swaps `through` and `while` both and keeps
     `most`.
   - `R/llm/harness-options/repeat-suggestion.ts` `throughTheStepAfter`: skips a do-while and returns `undefined`.
     Carrying it through another step would move its `while` off the last step.
   - `R/result-verification/build-test/span-rows.ts`: a do-while has no row labels, because the loop skips it when `over`
     is absent.
   - `R/result-verification/build-test/summary.ts`:
     - `targetWords` adds no "in each row ..." words for a do-while.
     - `routingValue` describes a do-while as `{ kind, through, while, most? }` in the draft's numbers.
     - `const repeated` (line 381) is left as it was. It only skips row keys, and a do-while member can hold no row
       binding.

`R/flow-draft/amendment/apply.ts` needs no change. Its `unrepeat` check (`kind !== "repeat"`), its tracking of repeats it
wrote, and its `keep` rule that never clears a repeat all work on both repeat shapes as they stand.

## Tests (fail-first, extending existing files)

- `R/llm/tests/evidence-loop.test.ts`: "reads a repeat while its last step succeeds, and leaves out one that says two
  things at once". It accepts `while`/`most` (including `most: 500`) and `through === while`. It drops `while: 0`,
  `while`+`over`, `most` without `while` (alone and with `over`), `most` in {0, 501, 2.5, "5", -1], and `through !==
  while`.
- `R/flow-draft/tests/routing.test.ts`, new describe "a repeat that runs again while its last step succeeds":
  - route writes `{through: d3, while: d3, most: 20}`; `already_so` on resend; `through`+`while` accepted;
    `no_such_step`, `not_a_kept_step`; a do-while is written on step 1 with nothing before it.
  - references are `[d3, d3]`; conditional reasons are empty for a do-while.
  - order problem: undefined while the span holds, `span_broken` when `while` is before the step.
  - a do-while written with its `while` before it is refused `no_such_position`. A reorder that breaks one takes it off
    with `{takenOff: "span_broken", through: 3, now: 3, throughNow: 1}` and no `over`.
- `R/flow-draft/amendment/tests/apply.test.ts`: "refuses a row field inside a span that repeats while its last step
  succeeds". The same step still binds once a repeat over a listing also covers it.
- `R/llm/evidence-loop/tests/rerun-replacement.test.ts`: "moves a do-while's through and while both onto the rerun of its
  last step".
- `R/llm/tests/draft-amendment-feedback.test.ts`: "says which step's repeat-while was taken off and why, with no over to
  name".

## Commands run and observed results

All commands ran from `C:/Users/osrs_/FluxStuff/fxwork/t283/!FluxIQ/packages/fluxiq`, with `R` as above.

1. Fail-first, before any source change:

   ```
   npx vitest run $R/flow-draft/tests/routing.test.ts $R/flow-draft/amendment/tests/apply.test.ts \
     $R/llm/evidence-loop/tests/rerun-replacement.test.ts $R/llm/tests/evidence-loop.test.ts \
     $R/llm/tests/draft-amendment-feedback.test.ts
   ```

   Result: `Test Files 5 failed (5)`, `Tests 8 failed | 169 passed (177)`. Every failure was one of the new tests:
   - route wrote `{ kind: 'repeat', through: 'd2', ... }` (the old over-repeat) instead of the do-while.
   - references came back `[ 'd2', 'd1' ]`, not `[ 'd3', 'd3' ]`.
   - the order problem was `undefined`, not `span_broken`.
   - the do-while with `while` before it was applied (`{ applied: 1, refused: [] }`).
   - the feedback `next` was `undefined` ("invalid for this assertion... undefined and string").
   - the parse returned `undefined` for a valid do-while.
   - the `$row` bind was applied (`{ applied: 1, refused: [] }`).
   - the rerun left a stale `over` key: `{ through: 'd3', ...(3) }`.
2. After the fix:

   ```
   npx vitest run $R/flow-draft/tests/routing.test.ts $R/flow-draft/amendment/tests/apply.test.ts \
     $R/flow-draft/amendment/tests/reach.test.ts $R/llm/evidence-loop/tests/rerun-replacement.test.ts \
     $R/llm/tests/evidence-loop.test.ts $R/llm/tests/draft-amendment-feedback.test.ts
   ```

   Result: `Test Files 6 passed (6)`, `Tests 183 passed (183)`. This covers `routing.test.ts` and
   `amendment/tests/*` whole (apply and reach). `apply.test.ts` now also holds another lane's schema tests, which pass.
3. Tests beside the item 7 readers, which I did not edit:

   ```
   npx vitest run $R/flow-bootstrap/instructed-acts/tests/checklist.test.ts \
     $R/llm/harness-options/tests/draft-acts-repeat.test.ts $R/llm/harness-options/tests/repeat-suggestion.test.ts \
     $R/result-verification/build-test/tests/summary.test.ts $R/result-verification/build-test/tests/pass-lines.test.ts
   ```

   Result: `Test Files 5 passed (5)`, `Tests 61 passed (61)`.

## Not verified

- No typecheck ran: the brief forbids `fluxiq:check` and builds. By reading the code, every remaining `routing.over` read
  in my files sits behind a guard that narrows the type to the `over` shape: the `RepeatIsWhile` false branch or
  `over !== undefined`. The lead's `fluxiq:check` after integration is the real check. The errors in `draft-routing.ts`
  and `entry.ts` are other lanes' to fix.
- `span-rows.ts` has no dedicated test; it is covered only through the summary and pass-lines tests.
- I added no new tests for the item 7 readers other than the rerun one, as the brief asked.
- No Lab, browser or provider run.

## Open questions or contradictions found

- `amendment/types.ts` (I must not touch it) still documents `over` on `repeat_taken_off` as "the step the repeat taken off
  was over", and documents `takenOff` as "the repeat on `step`, over `over`". A do-while taken off now carries no `over`.
  The lead may want to add one doc line there saying so.
- `apply.test.ts` changed on disk mid-task. Another lane appended a "do-while repeat the schema teaches" describe block. I
  did not touch it, and it passes.
- `flow-draft/tests/routing.test.ts` and `llm/evidence-loop-decision.ts` were rewritten with LF endings by my edits, while
  the working copy elsewhere is CRLF. The index is LF and `core.autocrlf=true`, so `git diff` shows only the content lines.
