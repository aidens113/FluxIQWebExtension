# t264-s4-w9-rerun-numbers-and-repeats: worker report

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t264/!FluxIQ`, branch `task/t264-core-integration-chain`.
R = `packages/fluxiq/src/programs/automation-studio/runtime/`. W8's uncommitted port is kept whole.

## Outcome

**Partial.** C1 (lane D w41) and w45 are ported following the binding decisions:
- dropped: `always`, the first-step sentence, w49/w50 and w46/w47;
- kept: t262's `unrepeat`.

`flow-draft/amendment.ts` is split into `flow-draft/amendment/` (12 modules and a barrel). These checks exit 0:
- the Core typecheck, the structure audit and `pnpm build`;
- the downstream domain and extension checks.

The brief's vitest set has **5 failures, all in two test files I may not touch**. Each failure needs the one-line test
edit lane D made for the same change:

1. `R/tests/service-bootstrap/tests/extend.test.ts` (4 tests, `flow_bootstrap.evidence_budget_exhausted`).
   - The fixture `RERUN_CARRIED = [rerun(1), rerun(3)]` pins the old receipt position. Under C1, `f2` stays step 2,
     so `rerun(3)` names the receipt and is refused.
   - Lane D's fix:
     - Line 148: `const RERUN_CARRIED = [rerun(1), rerun(2)];`
     - The doc comment above it now reads: "A rerun takes its step's own number and no other step's number changes:
       the step it replaced stays listed, withdrawn, at the end of the draft ... once `f1` is rerun the draft reads
       rerun, `f2`, `f1` withdrawn, so `f2` is still step 2."
2. `R/tests/deepseek-bootstrap/tests/observation.ts` (1 test in `answerability.test.ts`, "accepts the measured run's
   unanswerable completion ...").
   - It fails with `withoutInput: 1`, expected 0. By design, the receipt line has no `input`.
   - Lane D's fix: in `draftObservation`, the non-packed `withoutInput` condition becomes
     `(!("input" in step) && (step as Record<string, unknown>).inputTooLarge !== true && !("replacedBy" in step))`.

I did not apply either fix: both files are outside my brief, so these 5 tests have not been seen passing here. The
answerability test stops at its first failed assertion, so its later assertions are also unchecked.

## What changed and why

### Split of `flow-draft/amendment.ts` (658 lines, budget 800)

The file is replaced by `R/flow-draft/amendment/`, following `docs/architecture/code-structure.md`. The barrel exports
the same public names as before, plus `AUTOMATION_STUDIO_FLOW_DRAFT_REPLACED_ATTEMPT_REASON` and
`automationStudioFlowDraftReplacingStep`.

| File | Lines | Holds |
| --- | --- | --- |
| `index.ts` | 109 | Barrel and the module overview (header ported and updated) |
| `changes.ts` | 4 | `AUTOMATION_STUDIO_FLOW_DRAFT_AMENDMENT_CHANGES`, change type |
| `types.ts` | 121 | The amendment and refusal types |
| `act-id.ts` | 6 | `AUTOMATION_STUDIO_FLOW_DRAFT_ACT_ID` |
| `schema.ts` | 29 | `AUTOMATION_STUDIO_FLOW_DRAFT_AMENDMENT_SCHEMA` |
| `apply.ts` | 233 | `applyAutomationStudioFlowDraftAmendments`, `movedActs` |
| `bind.ts` | 161 | `bindStep` and its helpers, moved verbatim (renamed `automationStudioFlowDraftAmendmentBind`) |
| `route.ts` | 67 | `routeStep` |
| `move.ts` | 45 | `moveStep` |
| `shown-numbering.ts` | 25 | New (w45) |
| `repeat-revalidation.ts` | 121 | New (w45) |
| `replaced-attempt.ts` | 43 | New (C1) |
| `tests/apply.test.ts` | 571 | Was `flow-draft/tests/amendment.test.ts`, moved with the split |

Importers repointed (one import line each):
- `flow-draft/index.ts`;
- `flow-draft/tests/{act-claim,look-positions,opener,reversal,routing}.test.ts`.

### C1: a rerun keeps every other step's number

- **`R/llm/evidence-loop/rerun-replacement.ts`**: the rerun is spliced into the replaced step's index. The withdrawn
  attempt goes to the end of the draft with `replacedBy = <rerun id>`. The transcript rule is unchanged.
- **`R/flow-draft/step.ts`**: new `replacedBy?: string`.
- **`amendment/replaced-attempt.ts`**:
  - `automationStudioFlowDraftReplacingStep` follows the chain, bounded by the draft length.
  - The reason is borrowed (`not_a_kept_step`), as on the lane.
- **`amendment/apply.ts`**: every amendment naming a receipt is refused with `replacedBy`, right after `no_such_step`.
  This covers `unrepeat`. `replacedBy` is given in shown numbers.
- **`R/llm/evidence-loop/rerun-request.ts`**: a rerun of a receipt is refused the same way, before every other rerun
  check. Lane D's route/`movesStart`/`withheld` machinery (w50) is dropped.
- **`R/flow-draft/entry.ts`**:
  - A receipt's line is `{step, actionId, replacedBy, inResult: false}`.
  - The replacedBy sentence is now said **only when a receipt is listed**, the same way the `checkedCandidate`
    sentence already works. See the budget note below.
- **`R/llm/draft-amendment-feedback.ts`**:
  - New `replacedAttempt` `next`.
  - The `not_a_kept_step` text is widened.
  - **Merge decision:** following W8's rule that every refusal's `next` ends with the acts still to do, the
    replacedAttempt `next` appends `checklistLeft` when the checklist is present.

### w45: shown-number semantics and repeat revalidation

- **`amendment/shown-numbering.ts`**: one snapshot per decision. Every `step`, `to`, `check`, `through` and `over` is
  read from it. `to` means the place the step shown there holds: before it moving up, after it moving down
  (`move.ts`).
- **Merge decision, renumbering:** lane D deferred renumbering to the end of the decision. I renumber at each move
  instead.
  - The model sees the same thing either way, because no amendment reads a live position.
  - The reason is `flow-draft/reversal.ts`, which sorts the draft by `position` mid-decision (t262 calls
    `automationStudioFlowDraftDropReversals` inside the add path).
  - With deferred renumbering, those positions would be stale.
- **`move.ts`** keeps t262's Cause 6 rule: `replayed` is cleared from where the move begins.
- **`R/flow-draft/routing.ts`**: new `automationStudioFlowDraftRepeatOrderProblem`.
- **`amendment/repeat-revalidation.ts`**:
  - `automationStudioFlowDraftRepeatRefusal`: the deferred `over_not_before` / `no_such_position` check.
  - `automationStudioFlowDraftSettleWrittenRepeats`: takes a written repeat back when it cannot run.
  - `automationStudioFlowDraftTakeOffBrokenRepeats`: after a decision that moved a step, takes off every other broken
    repeat as `repeat_taken_off`, with `over`, `takenOff`, `through`, `now`, `overNow` and `throughNow`.
  - One addition of mine: a repeat taken off also clears `replayed` from its step on, as `unrepeat` does.
- **`amendment/route.ts`**: the order check is deferred to after the decision's moves. A same repeat sent again where it
  cannot run is told why, not `already_so`.
- **Schema (`schema.ts`)**:
  - Ported: the numbering sentence, the new reorder+repeat example, the revalidation sentence and the `to` wording.
  - Dropped: `always`.
  - Kept: t262's `unrepeat` text and W8's bind narrowing.
- **`entry.ts`**: both tellings carry the numbering sentence, shortened to "Every number in one amend_draft is this
  draft's; it is renumbered after the decision."
- **Feedback** (`R/llm/draft-amendment-feedback.ts`):
  - New reason text: `repeat_taken_off`.
  - New instructions: `NUMBERING_INSTRUCTION` and `TAKEN_OFF_INSTRUCTION`. The old "renumbered whenever a step moves"
    instruction sentence is removed.
  - New `takenOff` `next`.
  - Rewritten: `listingFirst` now says `18 reorder to 9` beside `9 repeat over 18`.
  - Unchanged: the `no_such_step` and `over_not_before` texts keep t262's extra sentences.
  - `repeat_taken_off` is never marked `repeated`, and an answer holding only such entries leaves out "The listed
    amendments changed nothing".
  - The final `next` chain is
    `takenOff ?? replacedAttempt ?? nextStep ?? actDone ?? notRunYet ?? stillToDo`.
- **Exhaustive records for the new reason:**
  - `R/flow-bootstrap/evidence-loop-steps.ts` allowlist: `repeat_taken_off`.
  - `packages/fluxiq/src/ui/activity-action/refusal-words.ts`: "moving a step left a repeat unable to run, so it was
    taken off".
  - `draft-edit-card.ts` needed no change: it reads these words by type.

### Answerability budget

The 5,000-byte draft budget in `answerability.test.ts` failed at first.
- With both new sentences always present, the largest 7-step entry measured **5,107 bytes**.
- After making the receipt sentence conditional and shortening the numbering sentence, it measures **4,929 bytes**,
  71 bytes of margin.
- The measurement used a temporary env-gated `console.log` in `entry.ts`, since removed (`grep -c W9` = 0).

### Tests

- **`amendment/tests/apply.test.ts`**:
  - Ported: lane D's receipt tests, with `unrepeat` added to the refused set; the musr9pv3 revalidation and numbering
    tests; and the updated murz83zy test (`2 repeat over 5 through 3`).
  - Adapted: every `always` use became `unrepeat`.
  - Dropped: `always`-only tests.
  - New: a test that a taken-off repeat clears marks from the move on, and a schema test.
- **`flow-draft/tests/routing.test.ts`**: the `RepeatOrderProblem` test.
- **`flow-draft/tests/entry.test.ts`**:
  - Ported: the receipt line tests, plus a check that the receipt sentence is absent without a receipt, and the
    numbering sentence in both tellings.
  - Dropped: the `always`, first-step and route tests.
- **`llm/tests/draft-amendment-feedback.test.ts`**:
  - Ported: the exhaustive list gains `repeat_taken_off`, the murz83zy updates, the receipt tests (plus a checklist
    suffix test) and the taken-off tests.
  - Dropped: the route test.
- **`evidence-loop/tests/`**:
  - `rerun-replacement.test.ts`: 2 tests edited and 1 new.
  - `held-amendments.test.ts`: 2 order updates.
  - `rerun-request.test.ts`: 1 receipt test; the route tests were dropped.
- **`ui/activity-action/tests/refusal.test.ts`**: 1 test for the `repeat_taken_off` words.

### Docs

- **`docs/architecture/automation-studio/llm-flow-bootstrap.md`**: lane D's C1 paragraph. Lane D's w42 hunk is not
  mine and was not ported.
- **`docs/architecture/automation-studio/flow-authoring.md`**:
  - New section "How one decision's step numbers are read", covering the numbering and the revalidation.
  - The `bindStep` path reference is updated to `amendment/bind.ts`.

### Lane D hunks accounted for (owned files)

| Hunk | Disposition |
| --- | --- |
| `amendment.ts` receipt header, `REPLACED_ATTEMPT_REASON`, `ReplacingStep`, refusal `replacedBy`, apply check | Ported (`replaced-attempt.ts`, `apply.ts`, `types.ts`) |
| `amendment.ts` numbering header, `ShownNumbering`, reorder/add via shown, `to` wording, `moveStep` by step, `placeExists` removed | Ported. The renumbering is merged as "at each move" (see above), and t262's `replayed` clearing is kept |
| `amendment.ts` `WrittenRepeat`, `repeatRefusal`, `takeOffBrokenRepeats`, `repeat_taken_off` and its fields, deferred route check | Ported (`repeat-revalidation.ts`, `route.ts`) |
| `amendment.ts` `always` (constant, branch, header, schema text), "Twelve changes" count | `always` dropped. The count is now twelve with `unrepeat` |
| `amendment.ts` `route_named`, `route` | Dropped (w50) |
| `routing.ts` `RepeatOrderProblem`; `step.ts` `replacedBy` | Ported |
| `entry.ts` receipt header, import, `stepLine`, replacedBy sentence | Ported; the sentence is made conditional |
| `entry.ts` numbering sentence (both tellings) | Ported, shortened |
| `entry.ts` `always` sentence; `START_SHORTCUT` / `AUTHORED_BEFORE/AFTER_START` (w45 first-step sentence, w49 caveat); `route` input and `startOnRoute` (w50) | Dropped |
| Feedback: numbering, taken-off and receipt headers; reason texts; `repeat_taken_off`; instructions; `listingFirst`; `takenOff`; `replacedAttempt`; repeated exclusion | Ported and merged with t262 and W8 |
| Feedback `route_named` text, `route` field | Dropped (w50) |
| `rerun-replacement.ts` receipt to the end | Ported |
| `rerun-request.ts` receipt check | Ported |
| `rerun-request.ts` `ADDRESS`, `movesStart`, `withheld`, `keepRoute`, `startStep`, `sameAddresses` | Dropped (w50) |
| `decision-handlers/amendment.ts` async, `routeOf`, `withheld` filter | Dropped (w50); file not changed by me |
| `evidence-loop.ts` `instructionRoute.known()`, `await` handler | Dropped (w50) |
| `evidence-loop.ts` repeat-guard `draftOf` / `draftKey`, `repeatsStall`, `MAX_REFUSED_REPEATS_IN_A_ROW`, comment compaction | Not C1/w45: repeat-guard work, left to W10/W11 (w46/w47) |
| `evidence-loop-steps.ts` `repeat_taken_off` / `route_named` | `repeat_taken_off` ported, `route_named` dropped |
| `draft-edit-refused.ts` words; `reasons.test.ts` | `repeat_taken_off` words moved to `refusal-words.ts`; `route_named` and its test dropped |
| `evidence-loop.test.ts` `always` parse tests | Dropped (`always`; file not owned) |
| `extend.test.ts` fixture; `observation.ts` `replacedBy` exemption | **Needed for C1, not owned**: see Outcome |
| `llm-flow-bootstrap.md` C1 hunk / w42 hunk | Ported / not mine |

## Commands run and observed results

- **Focused runs, from `packages/fluxiq`.** Final results:
  - `npx vitest run src/programs/automation-studio/runtime/flow-draft`: `Test Files 21 passed (21)`,
    `Tests 225 passed (225)`.
  - `npx vitest run src/programs/automation-studio/runtime/llm/evidence-loop`: `25 passed (25)`,
    `233 passed (233)`.
  - The `draft-amendment-feedback` test: `Tests 46 passed (46)`.
  - `src/ui/activity-action` with `R/activity`: `30 passed (30)`, `381 passed (381)`.
- **Answerability, before the budget fix:** `answerability.test.ts` failed with `overBudget: true`. After the fix,
  `Tests 3 passed (3)`.
- **The brief's vitest set**, `--minWorkers=1 --maxWorkers=4` over all eight directories, exited **1**:
  - `Test Files 2 failed | 314 passed (316)`
  - `Tests 5 failed | 3426 passed (3431)`
  - `Duration 123.19s`
  - The failures are the 4 `extend.test.ts` tests and the 1 answerability test, explained under Outcome. There were no
    timeouts.
- **Core root:**
  - `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0.
  - `node scripts/build-cache/cli.mjs structure-audit:check`: printed
    `structure-audit: passed (250 warning(s), 349 baselined).`, exit 0.
    - The warnings went from 249 to 250.
    - New advisory warnings: `apply.test.ts` (571 lines) and `draft-amendment-feedback.ts` (444 lines).
    - The old `amendment.ts` warning is gone.
  - `pnpm.cmd build`: exit 0, ending with the `web:build` step.
- **Downstream root:**
  - `pnpm.cmd --filter @fluxiq-web-extension/domain check`: exit 0, after
    `core-build: ... is current with its source.`
  - `pnpm.cmd --filter @fluxiq-web-extension/extension check`: exit 0.
- **Line endings and line counts.** A node count over every changed and new Core file printed `0 crlf` for each.
  Line counts:

  | File | Lines |
  | --- | --- |
  | `llm/evidence-loop.ts` | 796 (unchanged by me, one comment path edited in place) |
  | `entry.ts` | 260 |
  | `draft-amendment-feedback.ts` | 444 |
  | `rerun-request.ts` | 154 |
  | `rerun-replacement.ts` | 100 |
  | `routing.ts` | 218 |
  | `step.ts` | 361 |

- **`git status --short`:** shows only my owned files and W8's.
  - W8's: `act-claim.ts`, `decision-handlers/{amendment,types}.ts`, `moved-act-told.test.ts`.
  - Deleted: `flow-draft/amendment.ts` and `flow-draft/tests/amendment.test.ts`.
  - Untracked: `flow-draft/amendment/`.
  - `git diff --cached` is empty.
  - **Index note:** I first moved the test with `git mv`, which staged the rename. I unstaged it right away with
    `git restore --staged` on those two paths. No commit or history change was made.

## Not verified

- The 5 failing tests with lane D's two one-line fixes applied. The answerability test may have later assertions that
  differ.
- New tests failing first: I did not run them against the base. Lane D's reports record its failing-first runs.
- Live behaviour: no Lab, browser or provider call.
- `docs/reference/framework-reference.md` (generated by `pnpm docs:reference`, checked by `pnpm docs:check`) still
  lists the old `flow-draft/amendment.ts` paths and lacks the 2 new exports. It is not owned and was not regenerated.
  `docs:check` was not run.

## Open questions or contradictions found

- **Two non-owned test files must change for C1** (Outcome). They are a direct consequence of the ported design, so
  the supervisor or an owning worker should apply lane D's two edits.
- **Stale comment paths** in files I may not touch. Each still says `flow-draft/amendment.ts`, which is now
  `flow-draft/amendment/`:
  - `R/flow-draft/act-claim.ts:20`
  - `R/flow-draft/reversal.ts:46`
  - `R/flow-bootstrap/instructed-acts/choice-order.ts:20`
  - `R/llm/evidence-loop/trace.ts:98`
  - `R/service/flow-bootstrap-commands/evidence-trace.ts:162`
- **`R/llm/evidence-loop/held-amendments.ts`** (not owned): `settle` rewrites every refusal's `step` to the held
  amendment's number. A `repeat_taken_off` produced while settling a held move would therefore name the wrong step.
  This is an edge case (a held `add ... to` that breaks a repeat).
- **`repeat_taken_off` on the chat card:** it travels with the decision's refusals, so the edit card reads
  "partly done" with the taken-off words. The words are accurate, but the card frames them as "Not done". If that
  reads wrong, filter `repeat_taken_off` in `decision-answer/draft-edit.ts`, which is not owned.
- **The answerability budget margin is now 71 bytes.** The next sentence anyone adds to `AUTHORED_INSTRUCTION` will
  trip it, as lane D warned at 29 bytes.
- **The w45 first-step sentence was dropped.** The brief says to port "only" the revalidation and the shown-number
  semantics, so I dropped it; it was also merged with the w49 caveat on the lane. If it was wanted, it is a later
  unit.
