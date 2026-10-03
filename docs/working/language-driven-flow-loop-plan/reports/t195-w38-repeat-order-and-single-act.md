# t195-w38 repeat order and single act (lane D, round 1002-M; R8, R10)

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ` (branch `task/t195-live-control-flow`). Nothing committed.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. R8: a repeat refused because its listing comes after the act now gets a `next` naming the reorder and then the repeat, with the real numbers. R10: the acts checklist names, by number, each kept step that does a plural act to one row beside the repeat that does it to every row, and says to drop it. This is information only, and no gate changed.

## What changed and why

**How numbering works inside one decision (checked).** `applyAutomationStudioFlowDraftAmendments` applies a decision's amendments in order against one `steps` array, and `moveStep` renumbers it straight away. A later amendment in the same decision is therefore read against the renumbered draft. The decision handler (`R/llm/decision-handlers/amendment.ts`) passes `split.now` to it in one call, and holds back only amendments that name a rerun's step. For the run, the right batch is `{"step":18,"change":"reorder","to":9}` then `{"step":10,"change":"repeat","over":9}`. A `through` that sits between the act and the listing moves up by one. A new test shows such a batch applies (applied 2; the routing lands on the act, over the listing). That test passed before any code change, so the engine already handled it. Only the words sent to the model were wrong.

- `R/flow-draft/amendment.ts`
  - The refusal type has a new field, `through?: number`. It is set only when the repeat is refused `over_not_before`, `over` comes after the act, and the amendment gave its own `through`.
  - `routeStep` fills that field, and the refusal push carries it on.
  - One sentence added to the schema's `change` description: "When the listing comes after the act, reorder the listing to the act's position first, then repeat the act, which the move put one later: the amendments of one decision are read in order, each against the numbers the one before it left."
  - Module header: new paragraph on in-order numbering, with run `run-murz83zy-5030820f` (R8) as the reason.
- `R/llm/draft-amendment-feedback.ts`
  - `nextStep`, case `over_not_before`: when the step the repeat was put on is a working act (`mutate`, not failed) and `over` is a read after it, the new `listingFirst` writes the reply. Example: "Step 18 is the listing, and it comes after step 9, the act the repeat was put on … send {"step": 18, "change": "reorder", "to": 9}, which makes the listing step 9 and the act step 10, then {"step": 10, "change": "repeat", "over": 9}. Both may go in one decision…"
  - If the act is not in the Flow, the reply starts with "add step 9 with its act, then".
  - The general reason sentence for `over_not_before` now mentions reorder.
  - Module header updated with this run as the reason.
- `R/flow-bootstrap/instructed-acts/checklist.ts`
  - The checklist item has two new optional fields, `drop: number[]` and `dropSaid: string`. They sit beside `done`. They are deliberately **not** a new `todo` code: `R/flow-bootstrap/unfinished-build/not-done.ts` has an exhaustive record keyed by the todo type, so a new code would break that file, and I am not allowed to edit it.
  - New private helper, `singleRowSteps`. It looks at the act's step (the `done` step, or the judged step) and only works when that step is kept and inside a repeat span.
  - It collects every other step that is kept and proposable, does `mutate`, and sits in no repeat span, and that either names this act or matches the repeated step's control. A control match means the same `actionId` and the same folded `words.target` (falling back to `control`).
  - A step claimed for a different act is skipped. A step with no control words is never matched by words.
  - The sentence follows the brief's form. Real output for the run's last draft: "step 6 does a1 to one row; step 13 does it to each row step 7 keeps: drop step 6".
  - Header paragraph added (R10).
  - The items reach the model unchanged, because `automationStudioInstructedActsChecklistValue` spreads every field and `R/llm/harness-options/draft-acts.ts` passes them through.
  - I first wrote the helper as its own `single-row.ts`. That pushed `instructed-acts/` to 16 files, past the 15-file advisory, so I folded it into `checklist.ts`, its only user. The barrel ends with no net change.
- Tests (each written first and watched fail: 6 failed, 56 passed, 62 in all, before the code changes):
  - `R/flow-draft/tests/amendment.test.ts`: new describe "a repeat on an act that sits before its listing, run murz83zy". It covers the refusal carrying over and through, the reorder+repeat batch applying, and the schema sentence.
  - `R/llm/tests/draft-amendment-feedback.test.ts`: new describe for the listing-first `next`. It covers the run's own numbers (9/18 → 18 to 9, 10 over 9), through moving up by one, add-first, and no reorder offered for a failed act.
  - `R/flow-bootstrap/instructed-acts/tests/checklist.test.ts`: new describe. It covers the run's draft (`drop: [6]` with the exact sentence; `checkAutomationStudioInstructedActs` still `ok: true`; a1 still not in not-done). It also covers the "steps 2 and 9 … each" form with the exclusions (another control, dropped, failed, inside the span, claimed for another act), and both "says nothing" cases.

**Does the completion check already refuse such a draft? No.** The new test proves it. `checkAutomationStudioInstructedActs` returns `ok: true` for the R10 draft: step 6 names no act, and a1 is done by step 13. The only completion gate is `permission.ts`, which "confirm" does not trigger. That matches the live run, which went on to test (0084-0092). Gate behaviour is unchanged: R10 is information only.

Not changed: `R/activity/wording/draft-edit-refused.ts` (no new reason code, and its wording for `over_not_before` is still true). Also not changed: `R/flow-bootstrap/evidence-loop-steps.ts` (step records carry only `step`/`reason`/`nodeId`, so the new `through` field needs no allow-list entry).

## Commands run and observed results

All from the Core root.

- Failing first: `npx vitest run --exclude ".tmp/**" R/flow-draft/tests/amendment.test.ts R/llm/tests/draft-amendment-feedback.test.ts R/flow-bootstrap/instructed-acts/tests/checklist.test.ts` printed `Tests 6 failed | 56 passed (62)`. The failures were the 6 new tests that expected new behaviour. The batch-apply test passed at that point (see above).
- After the code changes, the same command printed one failure: my own test expected step 2, which was claimed for `a9`, to be included. That contradicted the exclusion rule in the test's name. I fixed the test draft (an unclaimed Confirm at 2, the a9 claim moved to 5). Checklist tests: `Tests 24 passed (24)`.
- Brief validation: `npx vitest run --exclude ".tmp/**" packages/fluxiq/src/programs/automation-studio/runtime/flow-draft packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts packages/fluxiq/src/programs/automation-studio/runtime/activity packages/fluxiq/src/programs/automation-studio/runtime/llm/tests` printed `Test Files 61 passed (61)`, `Tests 872 passed (872)`. I ran it before and again after the final refactor, with the same result.
- Narrow typecheck: a temporary `packages/fluxiq/tsconfig.w38-narrow.json` listing only my changed files (deleted afterwards). Run with `npx tsc -p packages/fluxiq/tsconfig.w38-narrow.json`.
  - First run, before the fold: no errors.
  - Second run, after the fold: exit 2. All four errors were in files other workers own, not in mine:
    - `unfinished-build/not-doable.ts(69,7)` TS2367 and `(70,26)` TS2339
    - `unfinished-build/phases.ts(399,159)` and `(401,131)` TS2322
  - These are concurrent edits to `unfinished-build/contracts.ts`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (224 warning(s), 349 baselined)`.
  - One advisory warning is mine: `llm/tests/draft-amendment-feedback.test.ts: 436 lines is past the 400-line advisory threshold`.
  - On the way there, moving the new tests into their own `llm/tests` file failed the audit (`llm/tests/: 26 source files exceeds the 25-file limit`), so I moved them back.

## Not verified

- Whole-package typecheck and full suites: not run, as the brief asked.
- No live run: whether the model actually sends the reorder+repeat pair, or drops step 6, after seeing the new words is unproven.
- I did not run the decision handler end to end with a reorder+repeat batch. The proof is at `applyAutomationStudioFlowDraftAmendments` level, plus a reading of `R/llm/decision-handlers/amendment.ts` showing it passes `split.now` in one call.

## Open questions or contradictions found

- The brief asked for a "todo" on the single-row step. A new `todo` code would break the exhaustive `TODO_WORDS` record in `R/flow-bootstrap/unfinished-build/not-done.ts`, which I must not touch. So it is carried as `drop`/`dropSaid` beside `done`. If the supervisor wants it as a todo code, the owner of `unfinished-build` has to add a wording for it in the same change.
- Matching "the same act" by control words can produce a false positive. Example: an unclaimed earlier press with the same action and the same words that is really a different act. Because the output is information only, a false positive costs at most one misleading line.
- `llm/tests/` is at 25 of 25 files (hard limit), and `instructed-acts/` is at 15, right on its advisory threshold. Future work that adds test files there has to group them first.
