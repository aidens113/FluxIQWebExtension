# t281-w15-core: refuse a second copy of a step already in the Flow (Core)

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t281/!FluxIQ`, branch `task/t281-lane-a-r3-fixes`, uncommitted.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done, with one placement change from the brief: the call-path helper lives in
`R/llm/decision-handlers/second-copy.ts`, not `R/llm/evidence-loop/`. See
"Open questions".

## What changed and why

**Rule** — `R/flow-draft/second-copy.ts` (new, one export
`automationStudioFlowDraftSecondCopy(steps, step)`, exported from `R/flow-draft/index.ts`).
It returns the kept step that `step` would copy, or `undefined`. The step must be
proposable. Candidates are other `kept`, proposable steps with the same `actionId`
and `toolId`, checked in draft order.
- (a) Both steps are `mutate`, with canonical-equal `input`, canonical-equal `ranWith`
  (both absent counts as equal), and the same `stateBefore`, which must be defined.
- (b) Both steps are `observe` and proposable, both carry the same defined `reads`, and
  no step with `disposition: "kept"` and `effect: "mutate"` lies between them in
  position order. The check is symmetric, and a step not yet in the list counts as last.

**New field** — `reads?: string` on `AutomationStudioFlowDraftStep` (`R/flow-draft/step.ts`),
documented like `toggle`. It is carried in the same places `toggle` is:
- The draft statement type: `R/llm/evidence-loop/tool-execution.ts`,
  `AutomationStudioLlmEvidenceToolExecutionResult["draft"].reads?: string`.
- The parse in `R/llm/evidence-loop-decision.ts`: `"reads"` is added to exactKeys. The
  value is kept only when `value.effect === "observe"` and it passes `closedCode`
  (`/^[a-z0-9_.:-]{1,100}$/i`). Anything else is withheld, never refused.
- `R/llm/evidence-loop/call-record.ts`: the return type gains `reads?: string`, and the
  value is spread from `declared.reads`.

**1. Call path**
- `R/llm/evidence-loop.ts` `draftRecord`: `draftSteps.push(appended)` now runs before the
  add decision. The step becomes `kept` only when
  `!automationStudioLlmEvidenceSecondCopyRefused(handling, appended)` holds too.
- A copy therefore stays `taken`. Act claim, place, openers and reversal are all gated
  on `disposition === "kept"`, so none of them run.
- Two lines changed in place, plus one import name added on the existing
  decision-handlers import line. The file is still 800 lines.
- The helper is `R/llm/decision-handlers/second-copy.ts`, exported from the barrel. It
  works the same way `automationStudioLlmEvidenceClaimWrittenAct` / `tell` do:
  - It builds `automationStudioLlmEvidenceDraftAmendmentFeedback` with
    `refusals: [{step: appended.position, reason: "second_copy", copyOf: copy.position}]`
    and passes `actsNotDone` from the checklist.
  - It supersedes the older entry and pushes the new one under `core.amendment_check`,
    after the call's own evidence entry.
- The model reads `next`: "Step M was not added to the Flow: step N already does this
  (the same press on the same page | a read of the same list with nothing changed in
  between); the Flow does each step once." When there is a checklist, the acts still
  to do follow.

**2. Amendment path**
- `R/flow-draft/amendment/apply.ts`: right after the `settings_rewrite_run` check, an
  `add` or `keep` on a step whose disposition is not `kept` is refused whole when the
  step copies a kept step: `{reason: "second_copy", copyOf: shown.number(copy)}`.
- `R/flow-draft/amendment/types.ts`: `"second_copy"` is added to the reason union, and
  the refusal gains `copyOf?: number`. Both were needed to compile.

**`R/llm/draft-amendment-feedback.ts`: every line changed**
- L152 (added): the `REFUSAL_REASONS.second_copy` entry. It says copyOf names the step
  of the Flow that already does it.
- L235 (changed): `secondCopy(...)` is inserted into the `next` chain, after
  `replacedAttempt`.
- L242 (added): `...(refusal.copyOf === undefined ? {} : { copyOf: refusal.copyOf })`
  on each refused entry.
- L442-457 (added): the private function `secondCopy(refusal, steps, actsNotDone)`. It
  picks the parenthetical from the `effect` of the step at `copyOf`, falls back to both
  kinds when the effect is unknown, and adds `checklistLeft` the way `replacedAttempt`
  does.

**Exhaustive maps**
- `src/ui/activity-action/refusal-words.ts`: `second_copy` = "another step in the Flow
  already does exactly that, and the Flow does each step once".
- `R/flow-bootstrap/evidence-loop-steps.ts`: `second_copy: true`.
- `R/llm/tests/draft-amendment-feedback.test.ts`: `second_copy: true` in `everyReason`.

**3. Edge case**
- In `apply.ts`, a drop or `exploratory` of a kept step no longer runs
  `automationStudioFlowDraftDropReversals` inline. It runs once, after
  `automationStudioFlowDraftStrandCheck`, and only when at least one withdrawn step is
  still out of the Flow after the check: `withdrawn.some(e => e.step.disposition !== "kept")`.
- A `kept` change still runs the reversal inline, as before.

**Tests**
- `R/flow-draft/tests/second-copy.test.ts` (6): the C9 shape (key order ignored), "+"
  pressed twice is not a copy, the guards (unknown pages, other target, other `ranWith`,
  both-absent `ranWith`, dropped or failed original, other tool), a read copy, a read
  after a kept press is not a copy (both orders), and the `reads` guards.
- `R/flow-draft/amendment/tests/second-copy.test.ts` (3):
  - `add` and `keep` are refused `{step 3, second_copy, copyOf 1}` and the draft is
    unchanged.
  - `copyOf` is the shown number after a reorder in the same decision.
  - A step already kept, or the same press from another page, is applied.
- `R/flow-draft/amendment/tests/drop-reversal.test.ts` (+2):
  - The dropped "off" half is the only way to step 3's page. The drop is refused
    `strands_a_step` with `strands: 3`, and the "on" half stays kept with no `cancels`
    and its act intact.
  - A drop that strands nothing still takes the "on" half out (`cancels d2`).
- `R/llm/decision-handlers/tests/second-copy.test.ts` (7):
  - `reads` parse and call-record carry, and the withheld cases.
  - Loop C9: d3 stays `taken` with no act, and decision 4 is shown `core.amendment_check`
    with `{step 3, second_copy, copyOf 1}` and the exact `next`, after the call's entry.
  - Loop read copy: d2 stays `taken`. After a kept press, d4 joins.
  - Loop "+" twice: both kept, and no feedback.
  - The feedback wording for press, read, unknown effect, and with the checklist.

**Docs** — `docs/architecture/automation-studio/flow-authoring.md`:
- The `reads` statement is added beside `toggle`, together with the reversal-after-strand-check note.
- A new subsection, "A Second Copy Of A Step Is Not Added", gives the rule and both paths.
- `toggle`'s statement is documented only in this file.

## Commands run and observed results

All runs were in `packages/fluxiq` unless noted.

**Fail-first**, before the implementation:
- Command: `npx vitest run R/flow-draft/tests/second-copy.test.ts R/flow-draft/amendment/tests/second-copy.test.ts R/flow-draft/amendment/tests/drop-reversal.test.ts R/llm/evidence-loop/tests/second-copy.test.ts R/llm/tests/draft-amendment-feedback.test.ts`
- Result: `Test Files 5 failed (5)`, `Tests 16 failed | 56 passed (72)`.
- The edge case failed for the expected reason:
  `expected [ 'kept', 'kept', 'kept', 'dropped' ] to deeply equal [ 'kept', 'kept', 'kept', 'kept' ]`.
- The loop test was in `evidence-loop/tests/` at that point and was moved later (see Open questions).

**After the implementation**, the same 5 files: `Test Files 5 passed (5)`, `Tests 72 passed (72)`.

**First full-set run**:
- Command: `npx vitest run R/flow-draft R/llm/evidence-loop/tests R/llm/decision-handlers/tests R/llm/repeat-guard/tests R/llm/node-tools/tests R/llm/decision-context/tests R/llm/tests/draft-amendment-feedback.test.ts R/flow-bootstrap/tests/evidence-loop-steps.test.ts src/ui/activity-action/tests`
- Result: `Test Files 109 passed (109)`, `Tests 1216 passed (1216)`.

**First typecheck and audit**:
- `npx tsc -p tsconfig.json --noEmit`: exit 2, a single test typing error in the `read()` fixture.
- `node scripts/build-cache/cli.mjs structure-audit:check` (Core root): exit 1 with 3 violations:
  - `evidence-loop/` has 26 source files, over the 25-file limit.
  - `evidence-loop/tests/` has 26 source files, over the 25-file limit.
  - `draft-amendment-feedback.test.ts` has 816 lines, over the 800-line limit.

**Fixes**:
- The helper moved to `decision-handlers/` and its loop test moved to `decision-handlers/tests/`.
- The `second_copy` feedback-wording tests moved into that test file.
- The fixture type was fixed.

**Final runs**:
- `npx tsc -p tsconfig.json --noEmit`: exit 0, no output.
- `node scripts/build-cache/cli.mjs structure-audit:check`: `structure-audit: passed (266 warning(s), 349 baselined).`, exit 0.
- The full vitest set again: `Test Files 109 passed (109)`, `Tests 1216 passed (1216)`.
- The 4 second-copy and drop-reversal files: 3 + 6 + 3 + 7 = `Tests 19 passed`.
- `wc -l R/llm/evidence-loop.ts` = 800. `R/llm/tests/draft-amendment-feedback.test.ts` = 792.

No build, no Lab, no full suite.

## Not verified

- No live behaviour, no Lab run, and no downstream test.
- No host emits `reads` yet, so rule (b) can fire only after the domain half lands.
- The full `pnpm test` / Core vitest suite was not run (per the brief). Only the directories named in the brief were run.
- `R/llm/node-tools/rerun-check.ts` deletes `step.toggle` when a checked rerun takes a new argument. It does not delete `reads`, because that file was outside my ownership. A rerun that reads a different list would keep the old `reads` until it is re-declared.

## Open questions or contradictions found

1. **Placement.** The brief said "a new helper under `R/llm/evidence-loop/`". That
   directory was already at the 25-file limit, and a subdirectory would exceed the
   9-segment depth limit (`maxPathSegments: 9`). The `evidence-loop/tests/` directory
   was also at 25. I put the helper beside `automationStudioLlmEvidenceClaimWrittenAct`
   in `R/llm/decision-handlers/`, as `second-copy.ts` exported from the barrel, and its
   test in `decision-handlers/tests/`. That is a new file in a directory the brief did
   not name. I edited `decision-handlers/index.ts` (barrel line plus header) but not
   `amendment.ts`.
2. **Files touched beyond the list.** `R/flow-draft/amendment/types.ts` (reason union
   and `copyOf`) and `R/llm/evidence-loop/index.ts` (left unchanged in the end) were
   touched; the reason and `copyOf` are needed for the brief's own requirement.
3. **Feedback beyond the minimum.** The brief asked for the minimal
   `draft-amendment-feedback.ts` change for `copyOf` to reach the model. I added a field
   line and a `next` function, because the brief's required call-path message names N
   and the kind of copy, which the static reason text cannot do. The lines are listed above.
4. **Edge case not covered.** If the same decision drops one toggle half and then
   `add`s/`keep`s another step, the inline kept-triggered reversal still runs before the
   strand check, so it could take out the partner of a drop that is later put back. I
   did not reorder that path because it would change established `add`/`keep` behaviour.
5. **Rule (b) reads the brief literally.** Any kept `mutate` step between the two reads
   blocks a copy, including a kept step whose press failed.
6. **Opener side-effect in C9.** In C9 the second press also pulled d19 in as an opener.
   With the copy now staying `taken`, openers never run for it. The amendment path
   refuses before openers too.
