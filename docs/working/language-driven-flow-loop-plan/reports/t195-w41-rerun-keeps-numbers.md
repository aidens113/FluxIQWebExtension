# t195-w41: a rerun keeps every other step's number

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ` (branch task/t195-live-control-flow).
`R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Partial. All three parts of the brief are implemented. The failing-first
output is recorded, the named vitest directories pass, the Core check exits 0
and the audit passes.

It is Partial for two reasons:

- **A test outside my owned paths now fails because it pins the old rule:**
  `R/tests/service-bootstrap/tests/extend.test.ts`. Its fixture is
  `RERUN_CARRIED = [rerun(1), rerun(3)]`, and the doc comment above it says
  "the draft reads rerun, `f1` withdrawn, `f2`, so `f2` is then step 3". Under
  the new rule `f2` stays step 2, so `rerun(3)` now names the receipt. That
  rerun is refused, and the build ends with `flow_bootstrap.evidence_budget_exhausted`
  (4 of 5 tests fail). I did not edit the file because it is not on my owned
  list. The fix needs two edits: change the line to `[rerun(1), rerun(2)]` and
  change that comment to "`f1` withdrawn at the end, so `f2` is still step 2".
  I have not run the file with this fix.
- **The refusal reason is borrowed, not a new `replaced_by`.** A new reason
  would break two exhaustive records in files I may not touch, so I reuse
  `not_a_kept_step` (see "Open questions").

## What changed and why

Evidence: run-musp474o-e0ed7432, at step logs 0105 to 0113. The receipt of the
step-6 rerun was placed at 7 and the Confirm moved to 8. The model then reran
"step 7" three times and got `changes_nothing` each time.

1. **The rerun takes the replaced step's number** (`R/llm/evidence-loop/rerun-replacement.ts`).
   - When `takesItsPlace` is set, the rerun is spliced into the replaced step's
     index. The withdrawn attempt (the receipt) is pushed to the end of the
     draft, the spot where the rerun had been appended, so no other step's
     number changes.
   - The receipt gets `replacedBy = <rerun id>`.
   - Everything else is unchanged: disposition, acts on a mutating rerun,
     routing moved and renamed, `standsFor`, `routeSignatures`. The older
     transcript rule still returns early, so it sets no `replacedBy` and keeps
     the old order.
   - The header comment cites the run.
2. **New step field `replacedBy?: string`** (`R/flow-draft/step.ts`). It holds the id of the rerun that replaced the step, and is documented with the run id.
3. **New resolver and refusal shape** (`R/flow-draft/amendment.ts`).
   - `automationStudioFlowDraftReplacingStep(steps, step)` returns the step that
     now stands in place of a receipt. It follows a rerun that was itself
     replaced to the end of the chain, and the number of hops is capped at the
     draft length.
   - `AUTOMATION_STUDIO_FLOW_DRAFT_REPLACED_ATTEMPT_REASON` is set to
     `"not_a_kept_step"`. This follows the existing `NOT_A_FLOW_STEP` precedent.
   - The refusal gets an optional `replacedBy?: number`: the position of the
     replacing step.
   - `applyAutomationStudioFlowDraftAmendments` refuses every amendment that
     names a receipt, right after the `no_such_step` check. Before this, an
     `add` on the receipt would have put the old listing back into the Flow.
   - The module comment cites the run.
4. **Reruns of a receipt** (`R/llm/evidence-loop/rerun-request.ts`). A rerun
   naming a receipt is refused the same way, with `replacedBy`. This check runs
   before every other rerun check, including `changes_nothing`, so the model
   hears which step to change rather than why this one would not run. The
   module comment cites the run.
5. **Draft entry** (`R/flow-draft/entry.ts`).
   - A receipt's line is now `{ step, actionId, replacedBy: <position of the replacing step>, inResult: false }`.
     Its old argument, `does`, `act`, `changed` and `disposition` are not shown.
   - The authored instruction gains one sentence: "A step showing replacedBy is
     the attempt a rerun replaced, listed only as the record of it: nothing
     changes it, so amend or rerun the step replacedBy names."
   - The header comment cites the run.
6. **Feedback** (`R/llm/draft-amendment-feedback.ts`).
   - A refusal carrying `replacedBy` gets this `next`: "Step 7 is the attempt
     step 6's rerun replaced: it is listed only as the record of what was
     replaced, and nothing changes it, so change step 6 instead -- amend it, or
     rerun it with what still differs. When step 6 already holds the argument
     you meant, its result stands as shown: go on from it."
   - The `not_a_kept_step` sentence now also names "the attempt a rerun
     replaced".
   - The header comment cites the run.

`system-prompt-pins.json` was not touched, because none of the changed
constants are pinned (checked with grep).

### Tests

New tests:
- `rerun-replacement.test.ts`: "keeps every other step's number: the attempt it replaced moves to the end, linked to the rerun".
- `entry.test.ts`: 2 tests, for the receipt line and for a chain of reruns.
- `amendment.test.ts`: 2 tests, for add, keep+act, reorder and bind on a receipt, and for a chain of reruns.
- `rerun-request.test.ts`: 1 test, a rerun of a receipt with `ranAlready` returning true.
- `draft-amendment-feedback.test.ts`: 1 test, for the `next` wording.

Existing tests updated because they pinned the old receipt position:
- `R/llm/evidence-loop/tests/rerun-replacement.test.ts`:
  - "withdraws the original ... stands in its place" now also asserts `replacedBy`.
  - "under the transcript rule ..." now asserts that no `replacedBy` is set.
  - "carries the routing ...": the order changed from d17, d15, d16 to d17, d16, d15.
- `R/llm/evidence-loop/tests/held-amendments.test.ts`:
  - "lands on the step that replaced it ...": the order changed from d1, d4, d2, d3 to d1, d4, d3, d2.
  - "keeps the position it named for another step ...": the expected order is
    now d1, d3, d4, d2, and the test is retitled. The rerun still lands after
    d3, as the original intent required.

## Commands run and observed results

All commands were run from the Core tree root.

- **Failing first** (output in scratchpad `t195-w41-failing-first.txt`):
  `npx vitest run --exclude ".tmp/**"` on the 5 changed test files, before the
  source change, gave `Test Files 5 failed (5)` and `Tests 9 failed | 86 passed (95)`.
  - Amendment: `expected 2 to be +0` (the `add` and `keep` on the receipt
    applied), and `[{step:3, reason:'already_out'}]`.
  - Rerun request: the refusal came back as `changes_nothing`.
  - Entry: the receipt line had 8 fields, and `replacedBy` was undefined.
  - Feedback: `next` was undefined.
  - Rerun replacement: the 3 order tests failed.
- **After the change**, same 5 files: `Test Files 5 passed (5)`, `Tests 95 passed (95)`.
- **First run of the named directories**: `npx vitest run --exclude ".tmp/**" R/llm/evidence-loop R/flow-draft R/tests/service-authoring R/llm/tests/draft-amendment-feedback.test.ts`
  gave 6 failures.
  - 2 were in held-amendments. They pinned the old order and are now updated.
  - 4 were in `confirm-requests-build.test.ts`, with `flow_bootstrap.pre_provider_validation_failed`.
    That test has no rerun. Run alone, it then passed: `Tests 4 passed (4)`.
    Other workers had uncommitted edits in the tree at the time
    (`llm/node-tools/replay-span.ts`, `llm/step-log/**`, `flow-bootstrap/unfinished-build/**`),
    so I treat it as transient.
- **Final run**: `npx vitest run --exclude ".tmp/**" R/llm/tests R/llm/evidence-loop R/flow-draft R/tests/service-authoring`
  gave `Test Files 70 passed (70)`, `Tests 770 passed (770)`.
- **Other rerun tests outside my directories**: observer, progress-trace,
  rerun-check, reauthor-service, repair-replay-chain, extend and
  response-envelope gave `Tests 4 failed | 65 passed (69)`. All 4 failures are
  in `extend.test.ts`. Run alone, it gave 4 failed and 1 passed, all with
  `flow_bootstrap.evidence_budget_exhausted`. The cause is the fixture
  described under Outcome.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195 w41 core check" pnpm --filter fluxiq check`
  printed the `tsc --noEmit` run and exited with `EXIT=0`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (240 warning(s), 349 baselined).`
  with exit 0. Line counts of the changed files: amendment.ts 625, entry.ts
  213, step.ts 315, feedback 285, rerun-replacement 100, rerun-request 146.
  All are under the 800-line limit.

## Not verified

- `extend.test.ts` with the proposed `[rerun(1), rerun(2)]` fix. It is not my
  file, and I have not run it.
- Live behaviour: no Lab run was made.
- Full suites were not run, per the brief.
- Other tests across the runtime that might pin the receipt position
  indirectly. I grepped only for tests that send `change: "rerun"`.

## Open questions or contradictions found

- **The dedicated reason conflicts with the ownership limits.** A new
  `replaced_by` reason must also be added to two exhaustive records.
  - Records: `EVIDENCE_STEP_AMENDMENT_REFUSAL_REASONS` in `R/flow-bootstrap/evidence-loop-steps.ts`
    (Must not touch), and `BECAUSE` in `R/activity/wording/draft-edit-refused.ts`
    (not owned). There are also exhaustive test lists in
    `R/llm/tests/draft-amendment-feedback.test.ts` and in the flow-bootstrap
    tests.
  - Effect: without those edits the build fails to compile, and the evidence
    step's allow-list would drop the refusal at runtime.
  - Fallback I took: the reason is borrowed as `not_a_kept_step`, and
    `replacedBy` plus `next` carry the specific wording.
  - Switching later: change `AUTOMATION_STUDIO_FLOW_DRAFT_REPLACED_ATTEMPT_REASON`
    in `amendment.ts`, then add the new reason to the union and to those
    records.
  - Side effect: the evidence step row strips `replacedBy`, since only `step`,
    `reason` and `nodeId` are kept, so step logs will record
    `<n>:not_a_kept_step`.
- **The extend fixture needs a follow-up** in `R/tests/service-bootstrap/tests/extend.test.ts`,
  as described under Outcome.
- `docs/architecture/automation-studio/flow-authoring.md` was not updated
  (docs are on the Must-not-touch list). It should gain a line saying a
  receipt goes to the end with `replacedBy`, and that amendments naming it are
  refused `not_a_kept_step` with `replacedBy`.
