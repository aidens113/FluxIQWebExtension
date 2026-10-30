# t811 / wb-step-labels (Core)

## Outcome
Done. `from` accepts the script label; all three acceptance checks clean at the last run.

## What changed and why
All paths under C/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap (F).
- `F/authoring/assemble.ts` (+4 lines): after the locator is built, `locator.stepKeys` = label -> node keys, from each block graph's existing `keyByLabel`. No other logic touched. Handler-block labels are not included (not from-step targets).
- `F/authoring/contracts.ts` (not in the owned list; one optional field): `AutomationStudioFlowBootstrapIssueLocator.stepKeys?: Record<string, string[]>`. Needed so the label map rides the acceptance result `acceptAutomationStudioFlowBootstrapResult` already returns. Please confirm this is acceptable.
- `F/subflow-candidate/contracts.ts`: optional `stepLabels` on `AutomationStudioSubflowProposal`.
- `F/subflow-candidate/scoped-submission.ts`: `read()` returns the accepted locator's `stepKeys`; kept per candidate digest in a new `labels` map; `carryLabels` puts them on the proposal in `proposalOf` (new and `known` proposals, so a relabelled script with the same plan carries its newest labels). The digest is computed from explicit fields (`subflow-digest.ts`), so labels are not in it; verified by a test (same digest and revision after relabelling). A JSON plan has no labels, so `stepLabels` is absent.
- New directory `F/step-label/` (keys.ts, resolve.ts, index.ts), NOT inside subflow-candidate: a subdirectory of subflow-candidate is 10 path segments deep, which the audit refuses (9 max). The barrel imports types from `../subflow-candidate/index.ts` (audit refuses deep imports).
  - `automationStudioSubflowFromStepKeys(latest)` -> keys and labels per key.
  - `automationStudioSubflowFromStepResolve(from, keys, labels)` -> exact key wins; else a label (exact, then case-insensitive) naming exactly one key; else `{ambiguous}` or undefined.
- `F/subflow-candidate/from-step-run.ts`: uses them. Unknown label or no match: `subflow.from_step_unknown` with `steps` (keys) plus `labelled: [{key, labels}]`. Ambiguous: same code, plus `ambiguous: [keys]`. On a run, `from` is the key and `fromLabel` is added when a label was used; the port, the repair (`afterFromStep`) and the instruction all use the key.
- `F/subflow-candidate/repair-words.ts`: `unknownStep(from, labelled)` mentions labels only if there are any; new `ambiguousLabel`. Generic words only.
- Tests: new `F/subflow-candidate/tests/from-step/tests/from-step-label.test.ts` (unique label runs; ambiguous refused; unknown refused with listing; key still runs and wins, JSON plan keys only and no `fromLabel`; repair clears through a label; submission carries labels, survives structuredClone, digest unchanged on relabel; none for a plan with no labels).
- Moved `subflow-trial-gate-latest.test.ts` to `F/subflow-candidate/tests/trial-latest/tests/` (imports adjusted).

## Commands run and observed results (inside heavy-check.lock)
- `tsc --noEmit -p .` (last run): printed nothing outside `tests/submit-then/` (I filtered those lines; an earlier run showed import errors there from Wa's in-flight move). Third run: no output before `TSC-DONE`.
- `FLUXIQ_TEST_GROUP=parallel npx vitest run .../subflow-candidate .../authoring`: `Test Files 59 passed (59)`, `Tests 488 passed (488)`. (Earlier run, before Wa finished: 1 failed in Wa's `submit-then/tests/builder-loop-auto-complete.test.ts`; gone in the last run.)
- `node scripts/structure-audit.mjs` last run: no FAIL and no violation lines. Earlier runs found (1) depth limit on my first location, (2) deep imports to `subflow-candidate/contracts.ts`; both fixed.

## Not verified
- Handler-block labels (`on <event>`) are not in `stepLabels`.
- Whole-package vitest and other callers of the locator type beyond the two directories run.
- The dispatch/supervisor/store carriers: not edited; they carry the proposal by structuredClone (the gate does `structuredClone(latest)`), and the test covers a clone of the submission proposal. I did not trace every store.

## Open questions
- `authoring/contracts.ts` edit (one optional field) was outside the owned list.
- Exports: `F/index.ts` does not export `step-label`; nothing outside imports it by the package barrel, so no export is needed from SC/index.ts.
