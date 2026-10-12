# t462-c-trial-acts — worker report

## Outcome

Done. One finding for the lead: `flow-bootstrap/candidate/trial-gate.ts` drops `acts` (see Open questions).

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime` in the Core worktree `fxwork/t462/!FluxIQ`.

- `service/candidate-trial/executed-steps.ts` (new): `automationStudioTrialExecutedSteps(attempts)` is the folding that used to be private in feedback.ts, moved unchanged together with the loop-id set. Its type `AutomationStudioTrialExecutedStep` now lives in `service/candidate-trial/contracts.ts`.
- `service/candidate-trial/feedback.ts`: now uses the moved function. The private `executedSteps`, `ExecutedStep` and `LOOP_DEFINITION_IDS` are gone. Nothing else changed, and the 21 existing feedback tests pass unedited.
- `service/candidate-trial/landed-acts.ts` (new): `automationStudioCandidateTrialLandedActs(trace, graph): AutomationStudioCandidateTrialAct[]`. It returns one entry per folded step (numbered `index + 1`, covering every step, not cut at 40) when all of these hold:
  - the final attempt's `automationStudioAttemptSettled(...).status === "succeeded"`;
  - the step is neither `stateHeld` nor `skipped`;
  - the node's `metadata.declaredConsequences` has at least one class that `isAutomationStudioActionConsequence` accepts.

  The classes go through `automationStudioConsequencesInOrder`, so they come out in Core's order with no duplicates. `label` and `control` (from `automationStudioModelFacingControlWords`) are added only when present, the same way feedback's `compact` drops empty values.
- `service/candidate-trial/run.ts`: `acts` is computed once after any run that executed, and is added to `result.acts` only when non-empty. This covers the execution_failed, result-unreadable (not_judged) and judged returns. A failed start hook returns early with no acts. `port.ts` returns `trial.result` as it is, so the field is kept; its identity-mismatch refusal has no acts.
- `service/candidate-trial/index.ts`: now exports `executed-steps.ts` and `landed-acts.ts`.
- `activity/candidate/trial-words.ts`: added two NOT_RUN entries:
  - `candidate.trial_reset_required` -> "the site first has to be put back the way the build found it"
  - `candidate.trial_start_differs` -> "the start page still differs from the way the build found it"
- Tests:
  - `service/candidate-trial/tests/executed-steps.test.ts` (new, 4 tests): retries are folded with the absorbed attempts kept, a node reached again is a new step, the loop pass is carried and then dropped, and an empty trace gives no steps.
  - `service/candidate-trial/tests/landed-acts.test.ts` (new, 4 tests):
    - succeeded lasting steps across retries and two loop passes come out as steps 3, 5 and 7, with Core's order and duplicates removed, and are cross-checked against `feedback.steps[step-1]`;
    - failed, stateHeld, skipped, `[]`-declared, unknown-class-only and undeclared steps are all left out;
    - step 46 is still numbered past the 40-step listing cut;
    - a missing trace or graph gives no acts.
  - `service/candidate-trial/tests/run.test.ts` (+3 tests):
    - a judged "no" trial carries acts, and so does the port's result;
    - an execution_failed trial carries acts. It uses the `execute` test seam: the real detached runner runs, then its receipt is forced to failed.
    - no acts when the press failed, when it declared `[]`, or when the start hook failed.
  - `activity/candidate/tests/result.test.ts`: two more rows in the gate-refusal table.

## Commands run and observed results

- `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/service/candidate-trial src/programs/automation-studio/runtime/activity/candidate` -> `Test Files 11 passed (11)`, `Tests 114 passed (114)`. The first run had one failure in my new execution_failed test, which I fixed: the press is the terminal node, so an unknown route still ended `yes`.
- `pnpm --filter fluxiq check` -> exit 2. All remaining errors are in files other workers own:
  - `action-permissions/tests/undo.test.ts(104,139)` and `(113,115)`, TS2322: `instructionDigest` missing.
  - `flow-bootstrap/tests/site-reset-calls.test.ts(39,43)`, TS2722.

  My earlier errors (in landed-acts.test.ts and run.test.ts) are fixed, and none remain in my files.
- `node scripts/structure-audit.mjs` -> `2 violation(s) across 2 rule(s)`, both in `action-permissions/tests/undo.test.ts` (as-never at line 87, contract-spread at line 99), which another worker owns.
  - It also reports "2 baseline entries can be lowered".
  - My statement-packing additions to run.test.ts are split, so that file is back within its baseline of 12.
  - An earlier run also showed import-cycle failures in `flow-bootstrap/site-reset/{index,start-check}.ts`, which belong to another worker. They are absent from the latest run.

## Not verified

- I ran no full suites, by the brief and the repository's validation rule.
- The trial gate path end to end: `acts` reaching `core.test_candidate`'s answer or the site-reset ledger.
- I have not run `pnpm structure:baseline`; the lowering it suggests is not mine to record.

## Open questions or contradictions found

- `flow-bootstrap/candidate/trial-gate.ts` around line 222 (`ask`) rebuilds the port's answer field by field: `{ revision, digest, verdict, feedback, trialRunId? }`. This drops `acts`, so the gate never sees them. It is under `flow-bootstrap/**`, which my brief says I must not touch, so the lead or the site-reset worker needs to carry `acts` through there and validate it: an array of objects with a number `step`, a string `definitionId`, and `consequences` limited to known classes.
- `service/flow-bootstrap-commands/candidate-generation.ts` passes the trial result through as `authored.trial` and does not copy it, so I expect no change is needed there.
