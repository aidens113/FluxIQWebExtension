# t193-wV: three draft-authoring defects from live run 34 (Core)

## Outcome

Partial. C5 and C7 are fixed and tested. C6 is fixed, but it borrows the existing reason `not_a_kept_step`, because a reason of its own needs a line in two files I don't own (see Open questions).

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ`, branch `task/t193-live-self-repair`. Below, R = `packages/fluxiq/src/programs/automation-studio/runtime`. No commit, stash or branch change. No provider calls and no Lab.

## What changed and why

**C5 (a rerun's success could not carry its act). Confirmed as a defect.**
- The bug: `R/llm/decision-handlers/amendment.ts` applied every non-rerun amendment before the rerun ran. So `4 add a1` beside `4 rerun` was judged on the failed step 4 and refused `did_not_work`.
- New `R/llm/evidence-loop/held-amendments.ts` (exported from `evidence-loop/index.ts`). It splits a decision's amendments in two:
  - `now`: everything else, applied in today's order and positions.
  - `held`: amendments that name the step the decision's runnable rerun replaces.
- `settle(steps, rerunStep)` decides what happens to the held amendments:
  - If the rerun step is proposable, i.e. it worked, they are applied to the step that replaced theirs.
  - Otherwise they are refused `did_not_work`, which is what the rerun was.
  - Their `to`, `check`, `through` and `over` numbers are read as the steps they named in the model's numbering. The rerun moves into its step's place, which renumbers everything after it, so this translation is needed. A number that named the replaced step maps to the rerun.
- The handler returns `held` on its `rerun` answer (type `AutomationStudioLlmEvidenceRerunHeld` in `decision-handlers/types.ts`). When something is held, the handler does not send refusal feedback yet.
- New `automationStudioLlmEvidenceSettleHeldAmendments` (in `decision-handlers/amendment.ts`):
  - It settles the held amendments, then sends one `core.amendment_check` covering the whole decision: the refusals given earlier plus the held ones.
  - It returns `amended` and `amendmentsRefused` for the rerun's own trace row.
  - The shared feedback code moved into a local helper, `tell`.
- `R/llm/evidence-loop.ts` (now 797 lines, limit 800) settles at two points:
  - after `automationStudioLlmEvidenceRerunReplaced` on the normal path, adding `...settled` to the rerun's row;
  - before `HandleFailedCall` when the rerun threw, which counts as not worked.

**C6 (an act claimed on a look was accepted). Confirmed as a defect.**
- `R/flow-draft/amendment.ts` now refuses three things on a step that is not an action (`!automationStudioFlowDraftStepIsAction`), i.e. a look: `add`, `keep`, and any amendment carrying an `act`. The look stays as it was.
- The reason is the constant `NOT_A_FLOW_STEP`, currently set to `"not_a_kept_step"`.
- Related change: the `did_not_work` check now also covers a failed `mutate` step that the caller marked `proposes: false`. That keeps the refusal reason the same as the word the draft entry now shows for that step.

**C7 (the step numbers the model saw were not the ones amendments resolve against). Confirmed as a defect, but the diagnosis was different from the debug's.**
- The entry was not stale. `decision-context/shown.ts` rebuilds `core.flow_draft` for every decision from the live `draftSteps`.
- The real cause: looks hold positions (`position = draftSteps.length + 1` for every appended step), but `entry.ts` listed only action steps.
  - In run 34 the numbers shown were 2, 3, 4. Step 1 was the opening look and step 5 was `snap.store`.
  - T4 added no visible line, so the entry was byte-identical at D4 and D5 (`2b1151de8f327008`). I checked this against the dump: lines 21 and 26 were shown the same key, and the steps listed were [2, 3, 4].
- Fix in `R/flow-draft/entry.ts`:
  - The entry now lists every step. A non-action step shows `disposition: "look"`; a failed mutate shows `did_not_work`.
  - Both instructions gain one sentence: a look is listed so its number shows, and it can never be added or do an act.
  - An entry with only looks and no acts checklist is still not shown, as before.
  - The entry now changes after every call, a look included.
- Doc comments in `flow-draft/step.ts` were updated to match.

## Commands run and observed results

All `npx vitest run` commands ran from `packages/fluxiq`. Running from the Core root also picks up eight stale copies under `.tmp/core-web-build/`.

**Baseline before any change**, `npx vitest run R/llm/decision-handlers R/llm/evidence-loop R/llm/evidence-progress R/llm/decision-context R/flow-draft R/llm/tests R/tests/service-bootstrap`: 78 files and 626 tests passed.

**New tests on unchanged code:** 8 failed and 1 passed.
- The one that passed is `held-amendments` "is refused when the rerun threw". HEAD also refused that add `did_not_work`, just earlier, so this test is a guard and not a reproduction.
- The C6 guard I added later ("failed press ... marked as no step") was not run on HEAD. By reading the code it fails there: HEAD's `entry.ts` filtered to action steps, so step 2 is not listed.

**New tests after the fix:** 10 tests in 3 files, all passing.
- `R/flow-draft/tests/look-positions.test.ts`: 5 tests.
- `R/llm/evidence-loop/tests/held-amendments.test.ts`: 4 tests.
- `R/llm/evidence-loop/tests/draft-numbers.test.ts`: 1 test.

**Full set after the fix:** 81 files, 633 passed and 3 failed (636 tests).
- `llm/tests/evidence-loop-tool-failure.test.ts` "is recorded under its call id ..." fails because of C7. It expects the draft to list only the press, at step 2; it now also lists the opening look at step 1. Its own comment ("Position 2: the initial observation is step 1 of the draft") describes exactly the hidden-number problem. This file is outside my paths, so I did not edit it (change below).
- `tests/service-bootstrap/tests/adaptation.test.ts`: 2 tests "Test timed out in 15000ms" (4 in an earlier full run). Run alone after the fix, `npx vitest run R/tests/service-bootstrap/tests/adaptation.test.ts` passed 1 file and 9 tests. I read these as load timeouts, not a regression.

**Type check:** `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193-wV tsc" npx tsc --noEmit -p packages/fluxiq/tsconfig.json` from the Core root returned rc=0, with no diagnostics printed.

**Structure audit:** `node scripts/structure-audit.mjs` from the Core root reported 1 violation, the pre-existing `service.ts` (4506 lines, baseline 4505). `evidence-loop.ts` is at 797 lines, a warning only.

## Not verified

- No live or Lab run, so model behaviour with the new look lines is not checked.
- The recorded-window replay tests in `decision-context` passed. I did not check whether any stored replay expectations outside the validation set pin the draft entry's shape.
- Held amendments are not added to the `core.evidence_history` amendment row. That row's `applied` still counts only what landed at decision time, plus the rerun. The model learns of a held refusal through `core.amendment_check` and the rerun's trace row.
- When the rerun threw, the failed-call row does not carry `amendmentsRefused` (that handler is not in my paths). The feedback entry still tells the model.

## Open questions or contradictions found

1. **Test outside my paths to update.** In `R/llm/tests/evidence-loop-tool-failure.test.ts`, the `shown.at(-1)` expectation's `steps` array needs this element added first:
   `{ step: 1, actionId: "inspect", input: {}, changed: "no", disposition: "look", inResult: false }`
   The press entry stays at `step: 2`. The comment can become "the initial observation is step 1 of the draft and is listed as a look".
2. **C6's dedicated reason.** Two files are needed, neither mine:
   - `R/llm/draft-amendment-feedback.ts`, in `REFUSAL_REASONS`, add:
     `not_a_flow_step: "That step only looked (disposition look): it is never in the Flow and does no act, so it cannot be added or kept or named by act. Add the step that does the act, running it first if it has not run.",`
   - `R/flow-bootstrap/evidence-loop-steps.ts`, in `EVIDENCE_STEP_AMENDMENT_REFUSAL_REASONS`, add `not_a_flow_step: true,`.

   Then in `R/flow-draft/amendment.ts`:
   - add `| "not_a_flow_step"` to `AutomationStudioFlowDraftAmendmentRefusal["reason"]`;
   - set `NOT_A_FLOW_STEP = "not_a_flow_step"`;
   - change the three test expectations of `"not_a_kept_step"` (in `look-positions.test.ts` and `draft-numbers.test.ts`).

   Until then the model reads the routing wording for `not_a_kept_step` ("It named a step the Flow does not contain -- one dropped, marked exploratory, or that did not work. Routing describes the Flow ..."). The new look line in the draft gives it the context.
3. **The debug's C7 wording is inaccurate.** "Entry recomputed only when `draftState` changes" is wrong: the entry is rebuilt every decision, and hiding the looks was the cause. The debug's C5/C6 line references are right.
