# t748-u2-undo-unmeetable: an act whose differing list no undo can put back is gate_unsatisfiable

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t748/!FluxIQ`, branch `task/t748-build-loop-followups`.
R = `packages/fluxiq/src/programs/automation-studio/runtime/`. No commits, no branch switches, no typecheck, build or
full suite.

## Outcome

Done. A new closed condition, `no_admissible_undo`, makes an open act `gate_unsatisfiable` in two situations:

- **Its differing list.** No undo under `undoes` could ever put back what the act's differing lists show. This is
  worked out from the ledger's own state.
- **Its own control.** The act's own toggle control answered a third state (`control_state_differs`, `no_call`) on
  what was its last open condition. The refusal that says so already lists the act apart, so there is no second try.

Such an act:

- is listed under `unsatisfiable()` / `actsUnsettleable`;
- is out of `inPlace` / `actsToUndo`;
- keeps every trial refused, with the honest exit (`acts_unsettleable`).

An act an undo can still settle is unchanged. Nothing new is admitted.

Validation results:

- The new test file fails 4/7 on HEAD; the 3 failures-to-be are the detections and the 3 passes are the guards. All 7
  pass after the change.
- Owned folders: 27 files, 328 tests pass.
- Consumer and prompt-contract folders pass.
- The Core audit passes.

## What changed and why

- **`site-reset/undo-reach.ts` (new, one exported function `automationStudioSiteResetUndoReach`).** Given the ledger
  and an act, it returns a judge for the open reasons the settlement judge leaves to site-reset.
  - **`undo` (a list that still differs).** It reads the act's differing groups, with their relevant scopes. Then it
    sorts the admission paths of `undo-admission.ts` into two kinds.
    - **Paths no read can rule out:** `chain` (a confirmation dialog), a transfer, an own toggle (press or toggle)
      not marked refused, a legacy act's created items, and a press on the act's own item. The own-item path counts
      unless a fresh, complete read of the list that item sat in no longer holds the item's subject.
      - If any claimable act of the ledger that is not spent has one of these, there is no verdict.
    - **Removals of one subject that is new on a list.** Either the t719 subject deletion, for an act that created
      that subject, or the t743 removal on a destination.
      - The destination counts if it is named, lent, or can still be named: any list with a receipt can be named on a
        look under `undoes`.
      - The removing act must be strict, and must have declared `create_new` or `modify_existing`.
      - The original must have been read before the removing act, and must not have held the subject.
      - Each act removes at most one subject this way, because once one lands the act is `spent` and `claim` refuses it.
  - **The act is unsatisfiable when either of these holds:**
    - the lists show something no removal reverses: a missing original row, a changed value of an original row, rows
      out of order (checked row for row and value for value, as `restored()` does), or the act's subject held
      differently on another scope of the group;
    - the new subjects cannot each be matched to a different act able to remove it (bipartite matching).
  - **`toggle`.** It is unmet once the act carries `pressBackRefused`.
- **`reset-settlement/judge.ts`.**
  - `unmet(act, more?)` now asks `more` for any reason the judge itself leaves open. Its "every reason unmet" rule is
    unchanged.
  - New `differing(act)`: the act's own list groups that differ, each with its relevant scopes.
  - `AutomationStudioSiteResetUnmet` gains `no_admissible_undo`. Header paragraph extended.
- **`site-reset/ledger.ts`.**
  - `unmet()` passes `undoReach(this.reachable, act)`. `reachable` is a new field built in the constructor, so the
    class gains no new method.
  - Header paragraph extended. The file is now 624 lines (it was 617).
- **`site-reset/undo-claims.ts` `target()`.**
  - A refusal with `failed: "control_state_differs"` sets `act.pressBackRefused`. This happens only when the declared
    control state is a string; a missing state never marks the act.
  - The refusal is then answered with `actsToUndo` and `actsUnsettleable` recomputed.
  - An `own` admission at the toggle's place clears the mark.
  - Header paragraph extended.
- **`site-reset/ledger-act.ts`:** new field `pressBackRefused?: true`.
- **`site-reset/undo-admission.ts`:** a header note only. `undo-reach.ts` mirrors these paths, so a path added or
  widened here must be added or widened there too.
- **`reset-answers/failed.ts` and `condition-words.ts`:** `no_admissible_undo` is added to the closed set, with these
  generic words: "No call this build may make can put back what still differs: it is not an item this build added that
  an undo here may remove, and no control of the act's own can be pressed back to how this build found it."
- **Tests.**
  - New `site-reset/tests/settlement-unmeetable.test.ts`, on a library reading list and a book's star. It covers four
    detections:
    - a rating changes a row the list held before the build;
    - a removal of an original row, whose own row is now gone;
    - two new rows, but one act able to remove only one;
    - an own control that answers a third state.
  - It covers three guards:
    - a new row on a named list: still to undo, admitted, settles restored;
    - a changed row whose own item is still there: still to undo, admitted `own`;
    - two new rows and two acts able to remove one each: both still to undo.
  - Three existing assertions changed, because the new behaviour is the intended one:
    - `ledger-subject.test.ts` "purported Delete moved ... sibling list": the act's one removal is spent, so it is now
      apart, not in place;
    - `ledger-subject.test.ts` "held-subject-changed": a changed value of a row held before the presses; both acts are
      now apart;
    - `undo-admission.test.ts` "neither state: control_state_differs": the refusal itself now lists the act apart.
  - In all three, trials stay refused.

## Commands run and observed results

All vitest runs used `cd packages/fluxiq && pnpm exec vitest run --maxWorkers=… --minWorkers=1 …`.

1. **Baseline, before any edit.** The three owned folders: `Test Files 26 passed (26)`, `Tests 321 passed (321)`.
2. **New test on HEAD source** (written before any source edit): `Tests 4 failed | 3 passed (7)`.
   - Three of the failures were `expected [] to deeply equal [ Array(1) ]` (`unsatisfiable()` was empty).
   - The toggle case's refusal did not match `actsToUndo: []` and `actsUnsettleable`.
3. **After the change, the new test alone:** `Tests 7 passed (7)`.
4. **The wide set:** the owned folders, plus `project-agents/dispatch`, `project-agents/supervisor`,
   `service/project-build`, `llm/deepseek/tests/system-prompt.test.ts`,
   `flow-bootstrap/plan/tests/extraction-vocabulary.test.ts` and `flow-bootstrap/plan/tests/issue-feedback*`.
   - Result: `Test Files 2 failed | 103 passed (105)`, `Tests 3 failed | 854 passed (857)`.
   - All three failures were in owned site-reset tests: the three assertions listed above. No consumer or prompt
     contract test failed.
5. **After updating those three:**
   - `ledger-subject`, `undo-admission` and `settlement-unmeetable`: `Tests 122 passed (122)`.
   - The three owned folders: `Test Files 27 passed (27)`, `Tests 328 passed (328)`.
6. **`node scripts/structure-audit.mjs` (Core root):** `structure-audit: passed (435 warning(s), 1152 baselined)`, plus
   "1 baseline entries can be lowered", which is not mine.
   - Advisory warnings on my files: `ledger.ts` at 624 lines and 29 methods (it was already past both thresholds),
     `site-reset/` at 18 files and `site-reset/tests/` at 24 files.

## Not verified

- **No typecheck.** Points checked by reading:
  - the `reachable` field type, `Parameters<typeof undoReach>[0]`;
  - `exactOptionalPropertyTypes` (the test avoids `state: undefined`);
  - `answer.evidence.failed` read off a `JsonObject`.
- **No live run or browser spec.** The job e2e spec (`job-failed-save.spec.ts`) was not rerun. It should be unaffected:
  its acts have removable new rows, or an own item.
- **The job run's own acts would not be detected by this rule.** Their trial spots carried the template row's item
  token, which is the domain defect in the debug, so the own-item path stays open. c5 already made those rows
  removable.
- **Project builds: other briefs' acts are not consulted.** The hatches and the matching use this ledger's acts only.
  Per the `project-ledger.ts` header, other briefs' acts are not on this brief's site; in serial builds that holds by
  assumption only.

## Open questions or contradictions found

- **The rule is conservative by design.**
  - Any open hatch (own item, transfer, toggle, chain) on any able act blocks the verdict. A holding toggle and a
    transfer that can no longer move back still count as open.
  - A call made without `undoes`, which is a new act and may be asked about, is not counted as a way to settle. That
    matches the brief's "admission paths". The `undo_already_done` words still offer that route.
- **The `pressBackRefused` mark is sticky until an admitted press back at the toggle's place.** It is not cleared by a
  later read that shows the act's state again. Because the act is listed apart, the model is told not to try, so in
  practice it stays apart.
- **Two new rows, one act.** The act is listed apart at once, before its one possible removal. Its undo is still
  admitted if tried, but the words say not to.
- **`undo-reach.ts` mirrors `undo-admission.ts` and is not derived from it.** A note in each header asks that they
  change together. A shared predicate module would remove the drift risk.
- **Proposed doc text** for `docs/architecture/automation-studio/llm-flow-bootstrap.md`, to sit beside the
  `gate_unsatisfiable` paragraph:

  > **No undo can put it back: `no_admissible_undo` (t748).** An open act is also `gate_unsatisfiable` when no undo
  > under `undoes` could ever settle it. Core decides this from its own reads (`site-reset/undo-reach.ts`). The only
  > undo paths that act on a list a read can describe are removals of a subject new on that list: the subject deletion
  > for an act that created it, or the removal on a destination the act named or can name, at most one per act before
  > it is spent. So where an act's differing list shows a row held before the build that is gone, a value of one that
  > changed, or rows out of order, or more new rows than the acts able to remove them, and no act has a path no read
  > can rule out (its own item still listed, its own toggle, a transfer, a pending confirmation), the act is listed
  > apart under `actsUnsettleable` with `failed: "no_admissible_undo"`. The same condition applies at once when the
  > act's own control, on its last open condition, answers a state that is neither the build's nor the act's
  > (`control_state_differs`). Trials stay refused, and the honest exit is offered. Nothing is newly admitted.
