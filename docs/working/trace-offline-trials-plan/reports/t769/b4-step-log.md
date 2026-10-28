# b4-step-log report

## Outcome
Done.

## What changed and why
AS = packages/fluxiq/src/programs/automation-studio/ in the Core t769 tree.
- New `AS runtime/llm/step-log/offline-trial-step.ts`: writes `NNNN-offline/meta.json` only (kind `offline_trial`, trialToolId, status, whitelisted outcome, gapStep, matchedOperations, recordedOperations, timing, scope fields, plain-words summary) and adds the listing row. Unknown outcome strings and non-integer counts become null; extra fields on the described object are dropped.
- `index.ts`: barrel export plus header list entry for `NNNN-offline`.
- New `tests/offline-trial-step.test.ts` (6 tests).
- summary.ts, listing.ts, readable.ts, naming.ts: no change needed (no reset-specific code; listing is kind-generic and the summary string is passed in).

Exported signature (verbatim):
```
export async function automationStudioLlmStepLogOfflineTrial<T>(
  meta: { trialToolId: string },
  run: () => Promise<T>,
  describe: (answer: T) => AutomationStudioLlmStepLogOfflineTrialOutcome,
  env: Readonly<Record<string, string | undefined>> = process.env
): Promise<T>
// AutomationStudioLlmStepLogOfflineTrialOutcome = { outcome: string; step?: number; matchedOperations?: number; recordedOperations?: number }
```
Summary wording: "Checked against the recorded run (not the site): <it passed | the recording has no match at step N | the earlier answer of no was kept | the earlier failure was kept | it was inconclusive | it was not tried | refused (<code>)>". The wording for kept_no/kept_failed is my reading; adjust if the semantics differ.

## Commands run and observed results
- Tests-first: the first run used a path filter that matched nothing ("No test files found"), so I did not observe a genuine red run before writing the implementation. Stated honestly.
- `pnpm test src/programs/automation-studio/runtime/llm/step-log`: parallel group `Test Files 9 passed (9)`, `Tests 51 passed (51)`; real-sql group matched no files; "all groups passed".
- `pnpm exec tsc --noEmit -p .`: first run died with V8 heap OOM; rerun with NODE_OPTIONS=--max-old-space-size=8192 gave 5 errors, all in `runtime/service/offline-trial/tests/subflow-*` (another worker's files: missing export `runAutomationStudioOfflineSubflowTrial`, implicit any). None in step-log.

## Not verified
Nothing calls the new function yet (wiring belongs to another brief). No Lab read of the folder.

## Open questions
Confirm the kept_no / kept_failed meaning for the wording.

UNIT READY: AS runtime/llm/step-log/offline-trial-step.ts, AS runtime/llm/step-log/index.ts, AS runtime/llm/step-log/tests/offline-trial-step.test.ts
