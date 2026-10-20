# Report: t741-b4-numbering (worker, Core)

## Outcome

Done. A scoped `unchanged_submission` (or `unchanged_after_no`, kept-condition or kept-step) refusal now names only
revision/digest pairs the trial gate accepts. An earlier plan sent again keeps its own revision. A refusal never
names the inner controller's revision number or the probe candidate's digest.

## What changed and why

Root cause, confirmed against the step files:
- The inner candidate controller (`candidate/submission.ts`) gives every submission it reads a number
  (`++this.revision`). It compares a submission only with its *last* accepted revision. So plan A, then plan B,
  then A again is accepted as a **new** inner revision. `proposalOf` returns the cached proposal for A's digest, so
  the brief answers A's old revision (photo 0375 "revision 12", social 0155 "revision 5"). That part was right.
- The refusals were wrong. A later unchanged refusal names the inner revision of the re-accepted plan plus the
  offset (photo 0381 "revision 14", social 0171 "revision 7"; the brief never issued either). It also names the
  inner probe candidate's digest (photo 0373 `9351…`, 0381 `0c34…`; social 0147 `30e3…`, 0171 `da09…`), not the
  proposal digest that `matches()` compares. The model tested what it was told and got `subflow.trial_stale_revision`
  (photo 0379, 0385).

Changes (Core, R = `packages/fluxiq/src/programs/automation-studio/runtime/`):
- R `flow-bootstrap/subflow-candidate/scoped-submission.ts`:
  - New `byInnerRevision` map. `proposalOf` records each inner revision as the proposal it is, including on a
    cache hit, so a re-accepted inner revision maps to the plan's first proposal.
  - New `numbering` object:
    - a revision maps to `byInnerRevision.get(inner)?.revision`, or to `inner + offset` when the inner number was
      never accepted (a refused submission's own number, which keeps the existing numbering stable);
    - a digest maps to `proposals.get(inner)?.digest`, or stays as it is.
  - The scope-refusal revision (`lastAccepted`) and inner refusals both go through `numbering`.
  - Header note added (t741).
- R `flow-bootstrap/subflow-candidate/submission-numbering.ts`: `automationStudioSubflowRenumberedRefusal` now takes
  that numbering instead of a bare offset, and maps:
  - the top-level `revision`;
  - feedback `revision` and `digest`;
  - `standingRevision.revision` and `.digest`;
  - `keptConditions[].revision`, plus `keptSteps[].revision`, which was missed before;
  - "revision N" and any 64-hex digest inside `instruction` and `issues[].message`. The retest words embed
    "using exactly revision N and digest D".

  `lastTrial` and `judged` are untouched, as before. The old early return when the offset is 0 is gone, because
  re-accepted plans need mapping even at offset 0.
- Tests: added a `describe` block with 2 tests to `subflow-candidate/tests/revisions-after.test.ts`, the existing
  numbering test file. I did not use a new file: `tests/` already holds 25 files, and a 26th would break the
  25-file `directory-files` structure budget, which test files count toward and no baseline entry covers.
  - Test 1 (offset 3): submits A, B, A, A.
    - Answers: 4, 5, then 4 again with A's digest.
    - The unchanged refusal: its top-level revision, feedback revision/digest, every "revision N" and every digest
      it names are A's 4 and A's proposal digest.
    - `matches()` accepts that pair, and `gate.test` on it answers `subflow.trial_yes`.
    - A following scope refusal names revision 4.
  - Test 2 (offset 0): A (unsure), B (judged no), A again (keeps its revision), B again.
    - B again is refused `unchanged_after_no`.
    - Its `standingRevision`, and the "using exactly revision N and digest D" words, name A's revision and proposal
      digest. All named revisions and digests are A's.

## Commands run and observed results

All in `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ/packages/fluxiq`:
- Before the fix (tests then in their own file):
  `pnpm exec vitest run .../subflow-candidate/tests/submission-numbering.test.ts` -> 2 failed.
  - Test 1: "expected 6 to be 4". This is the photo 0381 defect.
  - Test 2: `standingRevision` was `{revision: 3, digest: 1c0b…}`, expected `{revision: 1, digest: af98…}`.
- After the fix, the same file plus `scoped-submission`, `revisions-after` and `unchanged-after-no-words` tests
  -> 4 files passed, 34 tests passed.
- After moving the tests into `revisions-after.test.ts` and deleting the separate file:
  `pnpm exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate/tests/`
  -> "Test Files 24 passed (24)", "Tests 129 passed (129)".
  - `scoped-submission.test.ts`: 24 tests.
  - `revisions-after.test.ts`: 6 tests (4 existing, 2 new).

## Not verified

- No typecheck, structure audit or wider Core vitest run (the shared rules leave those to the lead). The lead should
  run the typecheck and `scripts/structure-audit.mjs`. File sizes:
  - `scoped-submission.ts` is 499 lines: over the 400-line warning, under the 800 limit.
  - `submission-numbering.ts` is 71 lines, with one export.
  - `tests/` is back to 25 files.
- I did not run tests outside `subflow-candidate/tests/` that use the controller (project-agents dispatch,
  supervisor).
- No live run.

## Open questions or contradictions found

- **Gaps in numbering remain, by design.** After A(4), B(5), A(4), the next new plan is revision 7, because inner
  revision 3 was used by the re-accept. Refused submissions already leave gaps today (the existing test expects
  "accepted as revision 6" after a refusal used 5). So I kept `inner + offset` for new proposals. No answer names a
  number the brief did not issue or does not map to a receipt.
- **The debug note and the brief disagree on the cache.** Fix 4 in the photo note says to "stop `proposalOf`'s cache
  from answering an older revision number". The brief says to answer a re-accepted earlier plan with its existing
  revision. I followed the brief.
- **Social 0155** (resubmit accepted as revision 5): by design. Revision 5's plan was sent again after revision 6.
  The inner controller compares only with the last accepted revision, and refuses a re-sent plan only if the judge
  refuted it. Revision 5's trial was `execution_incomplete`, not refuted, so the brief answered its existing
  revision 5. That answer was correct.
- **Social 0169** (revision 5 called stale): correct by the gate's rule. Refusals at 0157-0165
  (`completion_refused` and `unchanged_after_no`) cleared the standing proposal, so the gate answered "There is no
  valid latest proposal to test". The 0171 answer that followed named "revision 7" with an inner digest. That is
  this defect, now fixed (it would say revision 5 with `9570…`).
- **Social 0166-0167, outside my files:** `core.no_progress` and `already_answered` recommended revision 5.
  - The cause is `llm/candidate-receipt/receipt.ts`: `automationStudioLlmEvidenceLatestCandidateReceipt` returns the
    last `ok: true` submit answer in the evidence, skipping later refusals that cleared it. It is used by
    `llm/decision-handlers/answered-request.ts:55` and `llm/evidence-progress/redirect-facts.ts:23`.
  - The note wording is in `llm/evidence-loop/answered-request.ts:105` and `llm/evidence-progress/stall-redirect.ts:248`.
  - It neither checks whether a later refusal cleared the receipt, nor whether that receipt's trial already failed.
  - `llm/` is outside my ownership, so I did not change it.
