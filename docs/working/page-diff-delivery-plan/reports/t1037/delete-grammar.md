# t1037 (W3) phase 2, worker `delete-grammar`: the old way of authoring the draft, deleted

## Outcome

**Done.** The framework's seven edits are now the only draft grammar. These are gone:

- the old changes;
- the old schema;
- the `grammar` option;
- the transcript rule (`draftAuthoring`);
- the authored and transcript tellings;
- `decision-handlers/second-copy.ts`;
- the old keep-adds-nothing words;
- the stale model words.

Results of the checks:

- Typecheck and `pnpm --filter fluxiq check` pass.
- The structure audit passes. The baseline was lowered as Core's AGENTS.md says.
- Downstream model-text is ok.

The acceptance pass had 3 failures in the parallel group and 1 in real-sql:

- **Parallel, two fixed after the pass.** These are the run-4 capture count and a UI test of a deleted reason. A targeted re-run of both files, and of the other files I touched after the pass started, gave 7 of 7 files and 202 of 202 tests passing.
- **Parallel, the known one.** `build-routing` "run-munneauy" failed in the full pass and passed in the targeted re-run.
- **Real-sql.** This is the t1043 lane's `witnesses/tests/carried-undeclared.test.ts`, which I must not touch. See "Open questions".

## What was deleted (Core `packages/fluxiq/src`)

**Old grammar files.** All under `runtime/flow-authoring/draft/amendment/`:

- `changes.ts`: the 13-change list and the union type. The change type is now the seven edits (`AutomationStudioFlowDraftEditChange`).
- `schema.ts`: `AUTOMATION_STUDIO_FLOW_DRAFT_AMENDMENT_SCHEMA`.
- `move.ts`: `reorder` and `add` at a position. No edit moves a step now.
- `edits/is-edit.ts`.

**`types.ts`.**

- Fields `to`, `check` and `call` are gone.
- Refusal reasons `repeat_taken_off` and `not_an_edit` are gone, with the fields of the first (`takenOff`, `now`, `overNow`, `throughNow`).
- `repeat_taken_off` came only from `TakeOffBrokenRepeats`, which ran only after a move. I deleted it from `repeat-revalidation.ts`.
- `not_an_edit` existed only to refuse the old words. The parser no longer reads them, so it is unreachable.

**`apply.ts`, rewritten.**

- Removed: the `take`, `reorder`, `exploratory`, `optional`, `only_if` and `on_failed` branches, `add` at `to`, the `grammar` option and the moved-step revalidation.
- Framework semantics are now unconditional: pins, deleting `drafted`, and putting in the steps a repeat names.

**`route.ts`.** Writes only `repeat`.

**`repeat-hold.ts`.** The span check no longer projects a move.

**The decision parser and schema (`runtime/llm/evidence-loop-decision.ts`).**

- The parser reads only the seven changes and the keys they take.
- Any other change word, or the keys `to`, `check` or `call`, leaves that amendment out, as an unreadable amendment always was.
- The decision schema always offers the edit schema.

**The loop and its configuration.**

- `loop-configuration.ts`: `draftAuthoring` is gone.
- `evidence-loop.ts`: no `authoring` branches; steps are always appended `taken` and composed.
- `decision-handlers/types.ts`: `draftEdits` is gone.
- `decision-handlers/loop-check.ts`: the dead `draftKey` call fact is gone.
- `rerun/replacement.ts`: the `takesItsPlace` option and its non-framework branch are gone. `answer-first/flow-run/stand-in.ts` was updated to match.

**The tellings.**

- `draft/entry.ts`: `DRAFT_INSTRUCTION`, `AUTHORED_INSTRUCTION` and the `authored` input are gone.
- `AUTOMATION_STUDIO_FLOW_DRAFT_GUIDES` is now `[FRAMEWORK_INSTRUCTION]`. `provider-task/draft-guide.ts` works with it unchanged, and `draft-guide.test` passes.
- `decision-context/shown.ts`: `authored` is gone.

**Keep-adds-nothing.**

- `decision-handlers/second-copy.ts` and its barrel export are deleted.
- `KEEP_ADDS_NOTHING_INSTRUCTION` (the "add and act" words) is deleted. The framework's words take its name.

**Feedback and words for the deleted reasons.**

- `draft-amendment-feedback/feedback.ts`: `TAKEN_OFF_INSTRUCTION` is gone, and so is the repeat-taken-off handling.
- `way-out.ts`: `takenOff` and `takenOffWhile` are gone.
- The entries for the two deleted reasons are gone from `refusal-reasons.ts`, `fallback.ts`, `bootstrap/evidence-loop-steps.ts` and `ui/activity-action/refusal-words.ts`.
- `automation-activity/decision-answer/edit-words.ts` no longer words the old changes.

## Internal paths kept, and why

- **`applyAutomationStudioFlowDraftAmendments(..., { withdrawsReplacedAttempt: true })`.**
  - This is Core's only internal caller: `rerun/replacement.ts` withdrawing the attempt a rerun replaced, with a `drop`.
  - It is not the model's ruling. Under this option the drop keeps `drafted`, so the attempt stays the framework's, and it strands nothing.
  - This keeps today's behaviour: `rerun/tests/replacement.test` expects `["d1", "taken", 2, "d2", "replaced"]`.
  - A new test in `edits.test.ts` pins this against a model's drop.
- **`keep` of a left-out step.** This replaces the internal keep-as-add conversion. `keep` now carries the put-in checks (second copy, span routing, openers, act claim) directly. There is no internal `add`.
- **Repeat order check (`SettleWrittenRepeats`).** Kept: a repeat whose listing ran after its act is still refused when it is written.
- **Shown numbering and said-numbers.** Kept, but now close to the identity: only a rerun taking its step's place renumbers anything.
- **Routing kinds `optional`, `only_if` and `on_failed`.** These stay in `routing.ts`, assembly and the entry. Carried Flows hold them, and the dry run makes a sometimes-present step optional itself.
  - A bare `keep` still clears such a condition on a step in the Flow.
  - Only the edits that wrote them are gone.

## Model words changed

All of these now say that running a call puts it in the draft, and that `keep` puts back a step that was left out. None advises `add`, `take`, `reorder`, `optional`, `only_if` or detecting a list first.

- **`draft-amendment-feedback/`.**
  - `fallback.ts` is rewritten (`:51` act_not_done_there now says `keep`).
  - `refusal-reasons.ts`: `over_not_before`, `no_such_step`, `not_a_kept_step` and others.
  - `way-out.ts:122,134`.
  - `next-step.ts`: a listing after its act now says to do the act again after the listing, put the repeat on that new step, and drop the earlier one. It no longer says reorder.
  - `row-act.ts` and `notes.ts` (unreached).
  - `index.ts` (the account).
- **`node-tools/`.**
  - `rerun-check.ts:44,62,217-220`.
  - `dry-run-gate.ts` ("mark it optional").
  - `run/node.ts`: a list read names its list by a line's handle, and nothing is detected first.
- **Other `runtime/llm` files.**
  - `decision-reading/own-keys-lifted.ts:5`.
  - `unusable-decision.ts` (`amend_not_offered`).
  - `repeat-guard/feedback.ts` ("mark it optional", reorder, detect the list) and `candidate-feedback.ts`.
  - `harness-options/draft-route.ts` (route words).
  - `harness-options/bootstrap-completion.ts` (`DRAFT_SCRIPT_NOTE`: the seven edits).
  - `evidence-progress/stall-redirect.ts` and `evidence-loop/resume.ts` ("add it with act").
- **`draft/`.**
  - `entry.ts`: the `NAMED_ROUTE` and `LANDED` words say `keep`.
  - `dry-run.ts`: no `amend_draft optional`, `only_if` or reorder. A not-in-Flow step is "put it back (amend_draft keep)".
  - `full-run-required.ts`.
  - `amendment/said-numbers.ts:5`.
- **`bootstrap/`.**
  - `authoring/draft-routing.ts`: five assembly messages that said reorder or `only_if`.
  - `instructed-acts/choice-order.ts`: reorder is replaced by "do the act again after the choice".
  - `instructed-acts/optional-only.ts`, `check.ts`, `standing-option.ts`.
  - `plan/evidence-schema.ts`.
  - `authoring/instruction-record-columns.ts`.
- **Answer-first.**
  - `completion/result-columns.ts`: `OWN_LIST` and the closing words now follow D13. A read names its list by one of its own lines on the page that shows it, and finds the list itself.
  - `runtime/answer-first/guidance/guidance.ts`: "put a repeat ... on that step".
  - `result/take.ts` and `types.ts`: comments only. The ledger's `take` event is internal (a look the draft now holds) and was left in place.
- **The edit schema (`amendment/edits/schema.ts`).** Two rules that only the deleted schema still said are restored, because the behaviour they describe survives:
  - rerun's merge-patch rules (null removes a key, and so on);
  - bind's scope ("a value a step typed, or a read's condition; a press's control or option is never bound").

## Tests: migrated, deleted, replays

### Migrated to the seven edits, same behaviour

- **`add` became `keep`** in:
  - `apply`, `claim-refused`, `claim-verdict`, `drop-reversal`, `second-copy` (draft), `settings-rewrite-run`;
  - `loop-covered`, `act-claim`, `look-positions`, `opener`, `reversal`;
  - `amendment-told`, the `authored-draft` parse tests, `declaration-input`.
- **`exploratory` became `drop`** in `apply`, `repeat-hold`, `rerun-request` and `evidence-loop-provider`.
- **Conditions set on the step instead of by an edit.** In `routing.test`, `optional`, `only_if` and `on_failed` now go straight onto the step (as carried routing), for the replay, conditional-set and entry tests.
- **`optional` became `repeat` or `drop`** where the test was about something else:
  - the checked candidate in `apply`;
  - the held `span_holds_routing` case in `held-amendments`;
  - `settings-rewrite-run`;
  - `observer`.
- **`reach.test`.** The unreached case is now reached by `keep` of a left-out read after a step that does not lead to its page.
- **`unreached-told`.** Rewritten as a handler-level test that keeps a left-out step. It no longer runs the transcript loop.
- **Schema tests moved to `AUTOMATION_STUDIO_FLOW_DRAFT_EDIT_SCHEMA`.** These cover bind offered, bind's scope, place, while/most and loop-ending, in `apply.test` and `rerun-input.test`.
- **Word expectations updated to the new words** in:
  - `refusal-way-out`, `draft-amendment-feedback`, `page-loop-told`, `second-copy` (handlers), `dry-run`, `dry-run-gate`, `site-memory`;
  - `stall-redirect`, `draft-acts`, `draft-route`, `instruction-record-columns`, `draft-routing`, `choice-order`;
  - `rerun-check`, `run-node`, `repeat-guard/feedback`, `landed-out`, `optional-only`, `bootstrap-completion`;
  - `look-positions`, `draft-shown` (it now checks the instruction's own byte length, not "over 1000"), `entry`, `draft-guide`, `result-columns`, `asked-table`;
  - snapshot and pins: `explorer-system-prompt.txt` and `system-prompt-pins.json`, regenerated with `-u` and `FLUXIQ_UPDATE_SYSTEM_PROMPT_PINS=1`.
- **`stalled-amendments-replay`.**
  - "refused for the same reason": under framework drafting the first `keep` of a step in the Flow pins it, so the repeated refusal is a decision later. The test now reads the third decision.
  - The toggle test now expects the loop detector's `loop_steered` at decision 6 and `repeat_refused` at decision 7, where the no-progress redirect used to be.

### New tests

- `edits.test`: Core's withdrawal of a replaced attempt keeps `drafted`; a model's drop removes it.
- `llm/tests/evidence-loop.test`, "the changes an amendment may name":
  - each of the seven old words is unreadable, alone or beside a `drop`;
  - `to`, `check` and `call` are unreadable.
  - It was moved out of `authored-draft.test`, which would have passed the 800-line limit.

### Deleted, because the behaviour no longer exists

- **`take`:** in `apply.test` (2) and `evidence-loop.test` "taking an earlier read by call".
- **`reorder` and moves:**
  - `apply.test`: the reorder and repeat in one decision, the move-clears-marks block (3), the move-revalidation block (5), and the shown-numbering-after-move block (3);
  - `claim-refused` (2), `second-copy` (draft, 1), `act-claim` (1), `routing.test` (renumbered under it, plus the move half of the while test);
  - `repeat-hold`: reorder source (1), the condition-or-move span tests (4), and the condition rollback (1);
  - `held-amendments`: held move (1), held claim after a move (1), taken-off after a move (1).
- **`repeat_taken_off`:** `draft-amendment-feedback` (5), `ui/activity-action/tests/refusal` (1).
- **`not_an_edit`:** `edits.test` (2) and `amendment-told` (1). `edit-refusals` now keeps only `not_a_read`.
- **Old-schema and old-telling words with no surviving equivalent:**
  - `apply.test`: repeat on the act, and listing moved first;
  - `entry.test`: the three steps of a loop, never acting on items left out, write/bind/loop, the binding scope telling, numbering in both tellings, the continuing list in both tellings, `does`, and the old tellings unchanged.
- **Transcript-rule tests:**
  - `authored-draft` "kept as it runs";
  - `rerun/replacement` "appends the rerun kept";
  - `edits.test` "applied as it always was without the option".

### Recorded-build replays, migrated off the transcript rule

These replay recorded builds: `recorded-runs.ts` (`recorded-windows.test`), `build-routing.test`, `stalled-amendments-replay`.

- The `exploratory` amendments in the recorded scripts became `drop`.
- Everything replays as logged except run 4's D38.
  - The rerun at D32 now takes its step's place, so the logged "rerun step 24" names the replaced attempt and is refused `not_a_kept_step`.
  - It is recorded as a deliberate divergence (`A_RERUN_STANDS_IN_ITS_PLACE`).
  - `build-routing`'s run-4 count of captures with nothing reported is 27, down from 28, for that reason.

## Commands and results

All vitest runs went through `heavy-slot.mjs run t1037-delete` with `NODE_OPTIONS=--max-old-space-size=3072`, in `packages/fluxiq`.

**Acceptance pass:** `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/runtime/llm src/runtime/flow-authoring src/framework/automation-service src/runtime/adaptation src/server/fluxnode-api src/runtime/project-agents src/runtime/automation-activity src/ui`

- **Parallel:** `Test Files 2 failed | 1386 passed | 1 skipped (1389)`, `Tests 3 failed | 12873 passed | 2 skipped`.
  - The 3 were `build-routing` "three recorded builds" (run 4: 27 where 28 was expected; fixed after), `build-routing` "run-munneauy, rebuilt" (known), and `ui/activity-action/tests/refusal` "repeat a move took off" (deleted).
- **Real-sql:** `Test Files 1 failed | 257 passed (258)`, `Tests 1 failed | 1625 passed | 1 skipped`.
  - The 1 was `answer-first/witnesses/tests/carried-undeclared.test.ts`: `"carried":true` was expected in attempt 2's decisions, and the received value was `[]`.

**Targeted re-run after the fixes:** `--groups=parallel` over `build-routing`, `ui refusal`, `apply`, `evidence-loop`, `authored-draft`, `recorded-windows` and `stalled-amendments-replay` gave `Test Files 7 passed (7)`, `Tests 202 passed (202)`. That includes `build-routing` "run-munneauy", which failed in the full pass.

**Other checks:**

- `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit` (incremental) gave `exit=0`.
- `pnpm --filter fluxiq check` (Core root, heavy gate) gave `exit=0`.
- `node scripts/structure-audit.mjs` (Core root):
  - First run: 2 violations, both mine (`authored-draft.test.ts` at 807 lines, and a `\b` in a template literal in `apply.test.ts`). Both are fixed.
  - Then `pnpm structure:baseline`, as Core's AGENTS.md says to after removing a violation. Lowered: `[import-cycles] runtime/llm/decision-handlers/index.ts` 10 to 9. Removed: `decision-handlers/second-copy.ts`, and `[as-never] framework/persistence/.../run-dataset-store.test.ts` (that one was not mine; the audit found it gone).
  - Final result: `structure-audit: passed (576 warning(s), 902 baselined).`
- `node scripts/check/model-text.mjs` (downstream) gave `model-text: ok (203 scenario tokens, 570 model-facing Core files, 14315 string literals)`.
- Grep of downstream `domain/src`, `apps/extension/src` and `packages/test-runner/src` for deleted exports found none. Only historical docs mention them.

## Not verified

- No Lab, provider or live run, per the brief.
- Real-sql was not re-run after the last fixes. Those fixes touched only parallel-group files and the run-4 expectation.
- I did not show that `carried-undeclared` fails without my changes. I could not set my files aside without git.
  - Its script sends no `amend_draft`.
  - On its path my changes only remove branches that were already dead under the framework default (`authoring` was always true there).
  - It is a t1043 test, and the wiring pass (256 real-sql files) predates it (258 now).
- Downstream domain and extension tests did not run.

## Open questions or contradictions found

1. **`carried-undeclared`** (t1043 lane; I did not touch it). It fails under framework drafting. My reading is that the cause is the drafting switch, or its interaction with the t1043 merge, and not this deletion. The t1043 lane or the lead should run it at the wiring state to confirm.
2. **Downstream scripted models still send old changes**, which the parser now drops. Not edited, per the brief:
   - `packages/test-runner/src/attempt-lane/scripted-model/scripts/professional-network-accept-messaged-invitations.ts:110` sends `change: "add"`. Its tests are at `tests/...test.ts:161,174,189`.
   - `local-classifieds-save-dining-tables.ts:233,328` sends `change: "reorder"`. Its tests are at `:110,228`.
   - `add` to `keep` is close to mechanical.
   - `reorder` needs the script redesigned: do the act again after the read.
3. **`amendment.settings` is still read by the parser, but the edit schema does not offer it.** I kept it because the brief did not name it. If it goes, `settings-rewrite-run`'s settings half goes too.
4. **Guidance the deleted tellings carried that the framework telling does not.** The lead should decide whether any belongs in the framework telling or the edit schema:
   - the three steps of a per-item loop, and that the repeat goes on the act, never the listing;
   - never acting yourself on items the listing left out;
   - `write true`;
   - claiming a child choice id.
5. **Pre-existing, not fixed:** in `route.ts`, a `repeat` whose `over` names a step that does not exist falls back to the step before it, instead of being refused `no_such_step`. A test now uses `while: 9` for that case.
6. **Docs.** I replaced the one false sentence in Core's `docs/architecture/automation-studio/llm-flow-bootstrap.md` (the `draftAuthoring: "transcript"` option). About 78 other lines there still describe `add`, `exploratory`, `optional`, `reorder` and the rest as history, and need a doc pass.
7. **Other uncommitted changes in the worktree.** Many files in `bootstrap/` (candidate, reset-settlement, site-reset, action-permissions and others) were already modified when I started and are not mine.
