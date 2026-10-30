# w3 unchanged-after-no fix point

## Outcome
Done.

## What changed and why
All paths are under packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/ in the t806 Core tree.
- `unchanged-diff.ts` (new) exports `automationStudioCandidatePlanDiff(submitted, refuted)`. It returns `identical` plus whichever of these apply: `flowNamesReworded`, `stepLabelsReworded`, `datasetIdRenamed`, `stepsBehaviourDiffers`, `stepsAdded`, `stepsRemoved`. Steps are numbered from 1 in order across subflows.
- `unchanged-fix-point.ts` (new) exports `automationStudioCandidateFixPoint(...records)`. It reads the record's own `steps` list (entries with status failed or flagged), a numeric `step` or `failedStep`, and `readings[].step`. It returns `[{step, label?}]`, or undefined when the record names no step.
- `unchanged-submission.ts`: new optional inputs `first` and `plans`. When the code is unchanged_after_no and `first` is set, the feedback gets `diff` (needs `plans`) and `fixPoint`, and `instruction` gets one generic sentence pointing to them. Absent data adds nothing. No new refusal is created.
- `submission.ts` (the controller): all five `unchanged` call sites now pass the submitted and refuted plans. `renamedRefuted` now returns `{judged, plan}`. A `toldRefuted` Set, keyed by the judge's finding, decides `first`.
- `index.ts` barrel updated with the two new files.
- Tests: `tests/unchanged-submission-fix-point.test.ts` (4 tests):
  - the first refusal carries diff and fixPoint and the instruction mentions them, while the second does not;
  - a datasetId-only rename is described in diff;
  - fixPoint is omitted when the record names no step;
  - with no judged finding, the code stays unchanged_submission with no diff or fixPoint.

## Commands run and observed results
`vitest run` on unchanged-submission-fix-point.test.ts, unchanged-submission.test.ts and submission-refusal.test.ts, run under the heavy-check lock from packages/fluxiq. It printed: 3 files passed, 48 tests passed.

## Not verified
- No package typecheck (per the brief).
- Only the shapes of Core's judged feedback I could read in trial-gate.ts: a `steps` list with `step`, `status` and `label`. The `flagged` and `readings[].step` forms of fixPoint are speculative. They only ever add steps, so they cannot cause a refusal.
- The evidence-loop's tests were not run.

## Open questions or contradictions found
- The refusal-run counter lives in `llm/decision-handlers/refusal-run.ts`. It is applied after the refusal is built, and it is not reachable from candidate/. So "first" is tracked in the controller by a small Set of already-told findings. That is a second tracker, but it holds only a told-marker and does no counting. Fully reusing the llm counter would mean a change in llm/, which another lane owns.
- Two controller instances (for example a subflow builder with its own controller) each tell their own first refusal.
- The heavy-check lock was held by someone else from 14:52 until about 15:50, so the vitest run waited.
