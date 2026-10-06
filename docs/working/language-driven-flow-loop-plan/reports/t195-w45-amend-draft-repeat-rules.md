# t195-w45 amend_draft repeat rules -- worker report

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ` (branch task/t195-live-control-flow). Nothing staged or committed. `R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. All four parts are in place, each with a test that failed first. The brief's test directories pass, `pnpm --filter fluxiq check` exits 0, and the structure audit passes.

## What changed and why

Fixture: the 0072 draft from `run-musr9pv3-f4bf6256`, steps 13-16 as the run showed them, with 12 filler steps in front (`R/flow-draft/tests/amendment.test.ts`, "a stray repeat on a listing, run musr9pv3"). One extra test replays decision 0056 (`15 reorder to 14, 15 repeat over 14, 16 reorder to 15`) on the 0056 draft. Under the old code that decision put the repeat on the listing; it no longer does.

1. **`always` change** (`R/flow-draft/amendment.ts`)
   - Added to `AUTOMATION_STUDIO_FLOW_DRAFT_AMENDMENT_CHANGES`, so `R/llm/evidence-loop-decision.ts` reads it with no code change. That parser checks against the constant.
   - When applied it deletes `routing` (repeat, only_if, optional or on_failed) and merges any `settings`. It answers `already_so` when the step has no condition and no settings. The guards for a replaced attempt and for `did_not_work` apply to it as to every other change.
   - The amendment schema description describes it. `R/llm/deepseek/output-schema.ts` and `system-prompt.ts` are unchanged: the schema reaches the model from `AUTOMATION_STUDIO_FLOW_DRAFT_AMENDMENT_SCHEMA`, and neither the system prompt nor the pins list the changes.
   - `AUTHORED_INSTRUCTION` and `DRAFT_INSTRUCTION` in `R/flow-draft/entry.ts` both say: "always takes every run condition off a step -- repeat, only_if, optional or on_failed."
   - No activity wording lists the changes, so none needed `always`.

2. **A move revalidates repeats**
   - After any decision that actually moved a step (`reorder`, or `add` with `to`), every step's repeat is checked. A repeat is cleared when its `over` does not run before the step, or when its `through` now runs before the step.
   - Each cleared repeat is reported as a new refusal reason, `repeat_taken_off`. It carries `over`, `takenOff: "over_after" | "span_broken"`, and `through` when the span broke, all in the numbers the model was shown. It also carries `now`, `overNow` and `throughNow` where the numbers changed.
   - The check itself is `automationStudioFlowDraftRepeatOrderProblem` in `R/flow-draft/routing.ts`. It moved there to keep `amendment.ts` under the 800-line limit.
   - The words are in `R/llm/draft-amendment-feedback.ts`:
     - `next`: "Step 15's repeat over step 16 was taken off: after this decision's moves step 16 runs after step 15, ...", plus the new numbers.
     - A reason text, and an instruction line saying it is not one of the model's amendments.
     - The answer's lead sentence "The listed amendments changed nothing" is left out when every entry is `repeat_taken_off`, and these entries are never marked `repeated`.
   - Because the refusal type is exhaustive, the reason was also added to the allowlist in `R/flow-bootstrap/evidence-loop-steps.ts` and to `BECAUSE` in `R/activity/wording/draft-edit-refused.ts`. That card only shows when `applied === 0`, and a decision that took a repeat off always applied a move, so the card never shows for it.
   - Why it travels as a refusal: the caller, `R/llm/decision-handlers/amendment.ts` (not in my files), only forwards `amended.refused` to the feedback, history and trace row.

3. **Shown numbering, renumbered once**
   - `applyAutomationStudioFlowDraftAmendments` snapshots the numbering before the first amendment. `step`, `to`, `check`, `through` and `over` are all looked up in that snapshot.
   - `moveStep` no longer renumbers. `to` is read as "the place the step shown at `to` holds": before it when moving up, after it when moving down. For a single move this is the same as before.
   - The draft is renumbered once at the end of the decision.
   - A repeat the decision writes has its order checked after the decision's moves, so `reorder` and `repeat` may come in either order. If the check fails, the repeat is taken back, `applied` is decremented, and it is refused `over_not_before` or `no_such_position` as before. A repeat re-sent identical to the one the step already has is still told `over_not_before` rather than `already_so` when it cannot run.
   - Wording and tests updated to match:
     - `over_not_before` reason text and `listingFirst`: now `18 reorder to 9` beside `9 repeat over 18`, with `through` unshifted.
     - `no_such_step` text, plus a new numbering line in the feedback instruction.
     - The schema description and the `amendment.ts` header.
     - The murz83zy tests in `amendment.test.ts` and `draft-amendment-feedback.test.ts` (t195 1002-M C4), which pinned in-order renumbering.
   - Held amendments (`R/llm/evidence-loop/held-amendments.ts`) already read numbers as shown, so they agree with this.

4. **First-step sentence** in `AUTHORED_INSTRUCTION`: "The Flow's first step may go straight to the stable address where the work begins: once you have seen it is stable (no session-like parameters), rerun step 1 with it and drop the steps that only travelled there; keep optional dismissals."

Tests added or edited:
- `R/flow-draft/tests/amendment.test.ts`
- `R/flow-draft/tests/entry.test.ts`
- `R/flow-draft/tests/routing.test.ts`
- `R/llm/tests/draft-amendment-feedback.test.ts`
- `R/llm/tests/evidence-loop.test.ts`: the parse cases for `always`. They went here, beside the file's existing `automationStudioLlmEvidenceParseDecision` tests, because a new file pushed `llm/tests/` to 26 files, over the audit's 25-file limit.

## Commands run and observed results

- **Failing first.** Vitest on the four new or edited test files, before any source change: `Failed Tests 23`. Every new `always`, revalidation and numbering test failed, along with the entry wording, parse, taken-off feedback and updated R8 tests. The output is saved in the scratchpad as `t195-w45-failing-first.txt`.
  - Under the old code, `always` fell through to the disposition branch and was applied as `exploratory`.
  - "reorder first" was refused `over_not_before`.
  - The 0056 replay left a repeat on the listing.
- **Brief's directory run.** `npx vitest run --exclude ".tmp/**" --testTimeout=30000 R/flow-draft R/llm/tests R/llm/evidence-loop R/llm/deepseek/tests R/activity R/tests/service-authoring R/tests/deepseek-bootstrap R/flow-bootstrap/tests`, with R written out in full:
  - Final run: `Test Files 109 passed (109)`, `Tests 1193 passed (1193)`. I added `R/flow-bootstrap/tests` for the allowlist.
  - The first full run had 3 failures:
    - Two in `R/llm/evidence-loop/tests/repeat-guard.test.ts`. Another agent edited that file and `R/llm/repeat-guard/*` between 12:27 and 12:33, while my run was going (it started 12:29:46). Both pass on the later runs.
    - `R/tests/deepseek-bootstrap/tests/answerability.test.ts` "converges through the judge's no ...": `overBudget: true`. That one was mine; see the budget item below.
- **Typecheck.** `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195 w45 core check" pnpm --filter fluxiq check`:
  - Final run: `exit=0`, 0 `error TS`.
  - Earlier runs showed my missing `repeat_taken_off` in the test's reason map (fixed), and the other agent's `repeat-guard.test.ts(181,55)` `callId` error, which had cleared by the final run.
- **Audit.** `node scripts/structure-audit.mjs`: `structure-audit: passed (242 warning(s), 349 baselined)`.
  - The first audit failed on `llm/tests/` having 26 files and on `amendment.ts` at 817 lines. Fixed by moving the parse test into `evidence-loop.test.ts`, moving the order check into `routing.ts`, and tightening my header comments. `amendment.ts` is now 788 lines.
  - Advisory warnings on my files: `amendment.ts` and `draft-amendment-feedback.test.ts` are over 400 lines.
- **Budget measurement.** I added a temporary env-gated `console.log` in `entry.ts` (since removed) to measure the draft entry in the answerability test. The first wording made the authored guide 3906 bytes and the largest 7-step entry 5095, against the test helper's 5000 budget. I trimmed my sentences: guide 3782 bytes, largest 7-step entry 4971, and the test passes.

## Not verified

- No live run. Untested in practice: whether the model now writes shown numbers, uses `always`, or follows the first-step sentence.
- `R/llm/decision-handlers/amendment.ts` was not changed (not in my files). It counts `repeat_taken_off` entries in `refusedCount`, and its amendment memory may mark them `repeated`. The feedback ignores that mark for this reason. Its trace row and history record list them as refusals.
- Pre-existing and unchanged: `nextStep` in the feedback looks up a refusal's shown numbers in the post-decision draft. That only differs when one decision both moved a step and was refused for something else.
- Docs not updated (outside my files). A search of `docs/` found nothing describing amendment numbering or listing the changes.

## Open questions or contradictions found

- **Answerability budget margin.** The answerability test's 5000-byte draft budget is now 29 bytes from failing (4971). The next sentence anyone adds to `AUTHORED_INSTRUCTION` will trip it. Either the test's budget or the guide's length needs a decision.
- **What "move" means.** I took the brief's "reorder or move" to cover `reorder` and `add` with `to`, and only when a step actually changed place. A stray repeat already in a draft is cleared at the next decision that moves something, or by `always`; a decision without a move does not revalidate.
- **Your shared files.** The brief named `step.ts` and `evidence-loop-steps.ts` as mine to edit. I did not touch `step.ts`; its diff is another agent's `replacedBy` work. In `evidence-loop-steps.ts` I only added the one allowlist line. The `amendment.ts`, `entry.ts` and test diffs also contain other agents' uncommitted `replacedBy` work, which I left in place.
