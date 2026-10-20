# t743-c2-answers: actionable-answer contract for Core site-reset refusals

## Outcome

Partial. All six tasks are done inside the Owns list, and the narrow tests and the prompt contract test pass. One
piece is left for the lead. The sentence that item 5 asks me to qualify is not in `create-baselines.ts`: it is the
`core.project_action_declarations` body in `service/project-build/brief-ports.ts:258`, which I do not own. I added the
qualified guidance as `WORDS.actionDeclarations()`. brief-ports.ts must still be changed to use it (see Open
questions).

R = `packages/fluxiq/src/programs/automation-studio/runtime/` in Core worktree `fxwork/t743/!FluxIQ`.

## What changed and why

**New `R/flow-bootstrap/site-reset/answers/`** (nothing was added at the site-reset root, which stays at 25 files):

- `failed.ts`: `AUTOMATION_STUDIO_SITE_RESET_FAILED`, the closed tuple of 24 condition tokens, and the type
  `AutomationStudioSiteResetFailed`.
- `refusal.ts`: `automationStudioSiteResetRefusal(code, answer)`, the one constructor, plus
  `AUTOMATION_STUDIO_SITE_RESET_CAN_MEET` and the `AutomationStudioSiteResetCanMeet` type
  (`this_page | another_page | no_call`).
  - It requires a `candidate.*` code and, in `answer`, `failed`, `canMeet` and a non-empty `instruction`. It throws on
    anything outside the closed sets.
  - It returns `{ ok: false, code, failed, canMeet, condition, ...rest }`. `condition` is `WORDS.condition(failed,
    canMeet)`, so the words reach the model even where a caller later rewrites `instruction` (brief-ports
    `resetWorded`, `service/project-build/reset-calls.ts`). Every other field (act, actsToUndo, settle, ...) passes
    through unchanged.
- `index.ts`: the barrel.

I chose a separate `code` argument rather than a `code` key in the object. That keeps the scan simple: a `candidate.*`
literal is allowed only as the constructor's first argument or in an `===`/`!==` comparison.

**Refusal sites converted** (each now names its own failed condition):

- `undo-admission.ts`. Admission is unchanged: every path admits or refuses exactly as before.
  - Its own toggle's place:
    - still showing `toggle.to` with `back`: admitted, as today;
    - `state === toggle.from`: the new code `candidate.undo_already_back`, `already_back`/`no_call`. It carries the
      act's remaining `settle`, taken from its `inPlace()` entry, and the same `actsToUndo` as today;
    - neither state: `control_state_differs`/`no_call`;
    - other classes: `consequence_not_inverse`/`this_page`.
  - An identified control declaring nothing: `control_elsewhere`/`another_page` when the act has a toggle at another
    place, otherwise `undeclared_press`/`this_page`.
  - Transfer. `transferTarget` is now `transferUnmet(...) === undefined`, the same conjunction, so it holds in exactly
    the same cases. The first condition that fails is named:
    - `undo_spent`;
    - `consequence_not_inverse`;
    - `subject_differs`;
    - `destination_not_read_now`;
    - `subject_not_present_now`;
    - `transfer_not_witnessed`.
  - Subject deletion. `subjectDeletion` now refuses whenever `subjectDeletionUnmet(...)` returns a condition, under
    the same conditions as before. Conditions, in order:
    - `no_item_identity`;
    - `no_destination_read_before`;
    - `destination_not_read_now`;
    - `subject_there_before`;
    - `subject_not_present_now`;
    - `no_exact_inverse` (the act did not create);
    - `consequence_not_inverse` (the undo is not exactly delete).
  - Strict fallthrough (`unmatched`):
    - not about the act: `control_elsewhere` (toggle exists), `no_item_identity` (no subject), or `subject_differs`
      (the job r4 case: "This control is about a different item than the one the act was about. No call on this
      control can meet it...");
    - then `consequence_not_inverse`;
    - then the subject-deletion condition.
  - Legacy `candidate.undo_wrong_target`: `not_own_item`/`no_call`. The act is kept as before.
  - `toggle()` in `AutomationStudioSiteResetAdmissionLedger` now declares `from`. The ledger's `toggleOf` already
    returned it, so the ledger code is unchanged.
- `ledger.ts`, refusal construction sites only (plus the import). Shown as condition/canMeet:
  - `undo_act_kept`: `act_kept` or `act_left` (when settled unchanged), `no_call`;
  - `undo_unknown_act`, both sites: `act_not_listed`/`this_page`;
  - `undo_already_done`: `undo_spent`/`no_call`;
  - `trial_reset_unproved`: `acts_not_settled`/`another_page`.
  - The unissued-destination refusal comes from `create-baselines.ts` `unissued`.
- `trial-policy.ts`: `trial_reset_required` is `acts_in_place`/`another_page`; `trial_start_differs` is
  `start_differs`/`another_page`.
- `create-baselines.ts`:
  - `reset_destination_unissued`: `destination_unissued`/`this_page`;
  - `reset_witness_required`: `no_witness`/`another_page`;
  - `create_baseline_required`: `no_destination_original`. Its canMeet is `no_call` when the baselines are sealed
    with no original at all, otherwise `another_page`. Its inline instruction moved into
    `WORDS.createBaselineRequired()` unchanged, plus the own-URL clause.
- `reset-witness.ts` builds no refusal (it is a boolean predicate), so it has nothing to convert. It is still covered
  by the scan.

**`words.ts`**:

- `condition(failed, canMeet)`: one generic sentence per condition (the `CONDITIONS` map) plus one per canMeet:
  - `this_page`: "Another call on this page can meet it, as instruction says.";
  - `another_page`: "No call on this control can meet it; a call where instruction points can.";
  - `no_call`: "No call can meet it: do not make this call, or a variation of it, again."
- `unprovedUndo` no longer says "Inspect what this build created or changed". It points at the named condition and
  says not to resend when none can meet it. The other-act clause and the "fresh complete original-state evidence"
  sentence are kept.
- `alreadyBack()`, `createBaselineRequired()`, `actionDeclarations()` and `ownUrl()` are new.
  - `ownUrl()` returns "Name a list read on a page that loads at its own URL, so the reset can read it there again."
  - It is used in `witnessRequired`, `createBaselineRequired`, `actionDeclarations`, and the `resetDestination`
    description in `undoes-tool.ts`, so all four say the same thing.
  - I wrote "URL", not the brief's "address": the brief's own rule bans "address" in model-facing words, and the
    existing words tests reject it.

**Item 5, the guidance.** `actionDeclarations()` is the brief-ports body with only its first sentence changed:

- before: "Before making a reversible lasting effect, observe its destination's complete original inventory."
- after: "Before a reversible lasting press that has no other witness, observe completely the list where its effect
  would show; a control that shows its own state, or one inside a list already read complete, needs none." followed
  by the own-URL clause.

**Mechanical enforcement** (`site-reset/tests/refusal-sites.test.ts`). It scans every `.ts` file under site-reset, in
all subdirectories, skipping `tests/` and `answers/`, with comments blanked and strings kept. It fails on any of:

- `code: "candidate.` or `code = "candidate.`;
- `ok: false,` or `ok: false}` as a value (a type literal uses `;`);
- any other `"candidate.*"` literal that is neither the constructor's first argument nor part of a comparison.

A self-test checks that the scanner catches each hand-written form and passes the constructor, a comparison,
comments and type literals. The same file checks each ledger, trial-policy and create-baselines site's `failed`,
`canMeet` and `condition`.

**Tests:**

- New:
  - `answers/tests/refusal.test.ts`: constructor shape, throws, closed sets, words distinct and generic;
  - `site-reset/tests/undo-admission.test.ts`: every admission path's condition, and that `actsToUndo` is unchanged;
  - `site-reset/tests/refusal-sites.test.ts`.
- Updated:
  - `settlement-shapes.test.ts`: the "already-back" case now expects `candidate.undo_already_back`, and the other two
    cases expect their conditions;
  - `words.test.ts`: the `unprovedUndo` expectation, plus a guidance test;
  - `undoes-tool.test.ts`: the own-URL clause.
- site-reset/tests now holds 22 files, including another worker's `start-check-core-move.test.ts`.

## Commands run and observed results

All from `fxwork/t743/!FluxIQ/packages/fluxiq`:

1. Before any change: `pnpm exec vitest run src/.../site-reset/tests src/.../llm/deepseek/tests/system-prompt.test.ts`.
   21 files and 307 tests passed.
2. After the source changes, site-reset/tests: 2 failed, 266 passed. Both failures were expected: settlement-shapes
   "already-back" now gets `candidate.undo_already_back`, and words.test expected "created or changed". I updated
   both tests.
3. With the new tests:
   - The scanner self-test sample yielded 2 findings (the code-literal and stray-code rules both match), so I loosened
     that assertion to non-empty.
   - The refusal.test.ts realistic-word check caught "Follow" in `unprovedUndo`, which I reworded to "Heed".
4. Final run, `pnpm exec vitest run src/.../site-reset/tests src/.../site-reset/answers/tests`: **23 files and 298
   tests passed**. I ran it twice, the second time after typing fixes to the tests.
5. `pnpm exec vitest run src/programs/automation-studio/runtime/llm/deepseek/tests/system-prompt.test.ts`: **1 file,
   39 tests passed. No pins moved.** These refusals and `WORDS` are runtime evidence and guidance, not system-prompt
   prose, and brief-ports.ts is unchanged.
6. As an extra consumer check, I ran 11 test files outside my folder that read these refusals: 11 files and 111 tests
   passed. The files:
   - flow-bootstrap/tests: site-reset-build, site-reset-calls, site-reset-irreversible, action-permissions;
   - llm/repeat-guard/tests/reset-precondition;
   - llm/tests/repeat-policy;
   - project-agents/supervisor/tests/left-on-target;
   - service/project-build/tests: reset-calls, project-build-reset, project-build-reset-settle,
     project-build-brief-ports.

## Not verified

- No typecheck, as the brief forbids it. The generic `automationStudioSiteResetRefusal<C, A extends Answer &
  JsonObject>` and its `as` cast are untested by tsc. I fixed two likely test-only type issues (`JsonObject` return on
  `refusedFor`, `match.index ?? 0`).
- The structure audit was not run. By design, answers/ has three files plus tests, and no root files were added.
- No live run. Whether the job and photo builders now stop repeating is unproved until rerun round 5.
- I edited files with scripts and normalized their line endings back to CRLF. `git diff --stat` shows only real
  changes (257+/38- over my 10 files).

## Open questions or contradictions found

1. **brief-ports.ts (not owned).** The lead should replace the body string at
   `service/project-build/brief-ports.ts:258` with `AUTOMATION_STUDIO_SITE_RESET_WORDS.actionDeclarations()`. Until
   then, the unconditional sentence that misled the photo builder is still sent. This may also need a site-reset
   barrel import there, since `WORDS` is already exported from `site-reset/index.ts`.
2. **The debug's file attribution is wrong.** It says the guidance sentence comes "from site-reset/create-baselines.ts
   via brief-ports.ts", but in this tree it lives only in brief-ports.ts. create-baselines.ts holds only the
   identified-creation refusal, which needs a destination anyway, so I added the own-URL clause there and left its
   demand unqualified.
3. **Instruction rewriters.** brief-ports `resetWorded` and `reset-calls.ts` replace `instruction` on
   wrong_target/unknown/already_done/kept. They keep `failed`, `canMeet` and `condition`, so nothing is lost, but they
   rebuild nothing through the constructor. The scan covers site-reset only; `candidate.create_baseline_unavailable`
   and `candidate.undo_refused` in `flow-bootstrap/action-permissions.ts` are outside it and unconverted.
4. **I did not edit the site-reset barrel.** `site-reset/index.ts` does not re-export `./answers/index.ts` because it
   is not in my Owns list. Only site-reset itself uses the constructor now. Add the re-export if the c1 wave or others
   need the types.
5. **Some canMeet values are judgment calls.**
   - `transfer_not_witnessed`: I set `no_call`.
   - `destination_not_read_now`: `this_page`.
   - `subject_differs`: `another_page`.
   - Trial refusals: `another_page`.

   c1 (`gate_unsatisfiable`, actsToUndo membership) may want to read `canMeet: "no_call"` to drop an act from the
   to-do list. Today membership is unchanged, as the brief requires.
6. **The scan reads other workers' files too.** It covers every site-reset source file, including another worker's
   `start-check.ts`. A hand-built `candidate.*` refusal added there would fail `refusal-sites.test.ts`, which is
   intended.
