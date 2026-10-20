# t743-c5-dest-subject: undo removing a subject newly present on the act's named destination

## Outcome

Done. Core now admits, once per act and without asking, a removal on a list the act named. Every existing admission
path and refusal condition is unchanged, and the new path runs after them. The brief's narrow vitest set passes
(47 files, 428 tests), and the Core structure audit passes.

## What changed and why

All paths are under Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`.

- `site-reset/undo-admission.ts`
  - New path `destinationRemoval`, run after the t719 `aboutTheAct`/`subjectDeletion` block and before the
    strict/legacy refusals. It admits `on: "subject"` with the declared classes when all of these hold:
    - the act is strict;
    - the control's `scope` is one of the act's `destinations` or `lent` destinations (`namedDestination`);
    - `destinationRemovalUnmet` finds no failed condition.
  - The conditions, in order:
    - a subject token (`no_item_identity`);
    - not spent (`undo_spent`);
    - an original read of that list before this act (`no_destination_read_before`);
    - the list read completely now, with the group's latest read after this act (`destination_not_read_now`);
    - the subject absent in the original (`subject_there_before`);
    - the subject present now (`subject_not_present_now`);
    - the act declared `create_new` or `modify_existing` (`no_exact_inverse`);
    - the undo declares only `delete`/`modify_existing`, and at least one of them (`consequence_not_inverse`).
  - It records `act.subjectUndo = { scope, subject, group }`, as the existing subject inverse does, so the
    settlement's group witness reads that destination as today.
  - `unmatched`: when the control is not about the act and sits on a named destination, the refusal now names the
    removal's own failed condition. For example, an original row gives `subject_there_before`/`no_call` instead of
    `subject_differs`. A list the act never named keeps its old condition (`subject_differs`, `control_elsewhere`,
    `no_item_identity`).
  - `AutomationStudioSiteResetAdmittedAct` gains `destinations` and `lent?`. The header has a new bullet (t743) with
    the case and the rule.
- `site-reset/ledger-act.ts`: new optional field `lent` (the repeats' lent destinations as last gathered).
- `site-reset/ledger.ts`
  - `target()` refreshes `act.lent = this.judge.lent(act)` before admission. This is the same gathering the
    settlement uses, and it covers project builds, whose explored acts are other briefs'.
  - `explored()`: an undo on `subject` that landed (its `attempts` rose in `ran`) marks the act `spent`.
    `undo-claims.ts` (not owned) sets `spent` only for a `delete` declaration or a transfer `origin`, so a
    `modify_existing` removal would otherwise be admitted again. For the existing subject paths this is redundant,
    since they are already spent.
  - Header paragraph "Cross-page inverses" extended.
- `reset-settlement/judge.ts`: the inline lent-destination gathering in `evaluate` is now the public method
  `lent(act)`, used by `evaluate` and by the ledger's `target`. Behaviour is unchanged.
- `site-reset/tests/undo-admission.test.ts`: a new describe block, "a removal on a destination the act named". Its
  fixture is a library: a book kept from its own page naming the reading list (2 rows), and the list then holding 3.
  - The new row, with `delete` and with `modify_existing`:
    - admitted once;
    - a second removal is refused by `claim` (`candidate.undo_already_done`, `undo_spent`) and by the admission
      (`candidate.undo_unproved`, `undo_spent`);
    - after the list reads its 2 original rows, the act is `restored` and `beforeTrial` admits.
  - A `create_new` act is admitted the same way.
  - An original row is refused `subject_there_before`/`no_call`, with either class.
  - A list the act never named is refused `subject_differs`/`another_page`, even with a new row there.
  - Each other condition is named: `consequence_not_inverse`, `no_item_identity`, `subject_not_present_now` and
    `destination_not_read_now`.
  - A trial act repeating the explored act is admitted on the lent destination.
- No new reset-answers condition was needed. No file was added or moved.

## Commands run and observed results

All vitest runs were from `fxwork/t743/!FluxIQ/packages/fluxiq`; the audit ran from the Core root.

- `pnpm exec vitest run --maxWorkers=2 --minWorkers=1 <R>/flow-bootstrap/site-reset/tests/undo-admission.test.ts`:
  - first run: 7 failed. The cause was my fixture: `destinationReceipts()` lists only the latest read's refs. I fixed
    the fixture, not the code.
  - then: `Tests 23 passed (23)`.
- To show the spent fix is needed, I temporarily disabled the new `spent` line in `ledger.ts` and reran: `1 failed |
  22 passed`, the `modify_existing` case. I then restored the file from a scratch copy.
- `pnpm exec vitest run --maxWorkers=2 --minWorkers=1 <R>/flow-bootstrap/site-reset <R>/flow-bootstrap/reset-settlement <R>/flow-bootstrap/reset-answers <R>/service/project-build/tests`:
  `Test Files 47 passed (47)`, `Tests 428 passed (428)`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (429 warning(s), 1152 baselined)`.
  - It also printed "1 baseline entries can be lowered". That entry does not appear to be mine; I did not run
    `pnpm structure:baseline`.
  - The warnings on touched files were already there before this change: `ledger.ts` file lines (now 617) and its
    class-method count.

## Not verified

- No typecheck (forbidden by the brief). Vitest type-strips, so a type error (for example `lent` under
  `exactOptionalPropertyTypes`) would not show here. The types were checked by reading.
- No browser spec. The job spec (`apps/extension/e2e/site-reset/tests/job-failed-save.spec.ts`) was not rerun.

## Open questions or contradictions found

- The job spec's step 6 (`undo.held`, on a row My jobs held before the build) asserts `failed: subject_differs`,
  `canMeet: another_page`. As the brief asked, it now answers `subject_there_before` / `no_call`, so that assertion
  must change. Step 7 (`modify_existing` on the new row) should now be admitted.
- The `spent` marking for a landed `modify_existing` subject undo lives in `ledger.ts`, because `undo-claims.ts`
  (line ~180, which sets `spent` only for `delete` or a transfer `origin`) was not mine to edit. Moving that rule
  into `undo-claims.ts` would be cleaner if the supervisor wants it there.
- The new path also requires the group's latest read to come after the act (`groupObservedAfter >= sequence`). The
  t719 `subjectDeletion` path does not check this, and it was left unchanged.
