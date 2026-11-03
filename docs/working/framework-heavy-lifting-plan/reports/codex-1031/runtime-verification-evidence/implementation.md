# Deterministic processing exclusion evidence

Outcome: Done — implementation and owning provider-free tests; lead acceptance remains independent.

## Reproduction and change

The initial synthetic library-catalogue regression used the actual `processAutomationStudioRecordRows` producer, `summarizeAutomationStudioRunResult` screen/value readers, and `automationStudioResultVerdict`. Before implementation the measured exclusions had no `leftOutSettled`; one positive assertion failed and the quote/affirmative negative case passed. No provider, browser, runtime or SQLite startup was used.

The processing producer now copies its structured condition and evaluation clock into optional `evaluation` context and records each excluded label's actual primitive tested value as `tested`. Real missing/null/blank cells are `absent`; unsupported values and existing withholding markers are `unavailable`. Numeric text is usable only when it preserves the original evaluator result. Same-label captures share evidence only when the label column and tested reading agree across all captures, including kept copies; conflicting evidence stays unavailable.

The processing summary validates the optional public-contract shapes at runtime, checks field/wording/context consistency, and screens both condition operands and tested cells under the actual tested field and declared denied keys. Secret-shaped cells become `withheld`, not absence. Missing declarations transport counts only. Inputs and mutable condition arrays are copied.

A private `value-readings/processing-readings.ts` adapter requires the actual authored condition, matching index, wording, field, finite recorded clock and aligned screened observations, then reuses existing native-read settlement. It supports the native helper's existing numeric/date-bound, presence and text readings. Mixed unsupported conditions, relative windows, unreadable numeric/date values and conflicting/missing observations retain their obligations. Missing authored nodes never activate a fallback. The helper is not re-exported from the directory barrel.

`request-rows/summary-reads.ts` now carries these measured processing settlements using the same condition names and request-quotation rules as native reads. An affirmative model judgment still must quote the request in a sentence naming that condition. No verdict, quote-association, model-approval, retry, permission or acceptance policy changed.

An expanded regression run caught one introduced interaction: allowing exclusion settlement on an empty answer also allowed hidden-sort readings without visible rows. The hidden-sort row guard was restored independently; the final owning regression run passed.

## Owned changes

All source changes are in the nested t841 Core checkout:

- `packages/contracts/src/record-sets/process/types.ts`
- `packages/contracts/src/record-sets/process/process-rows.ts`
- `packages/contracts/src/record-sets/process/tests/process-rows.test.ts`
- `packages/contracts/src/record-sets/process/tests/condition-evidence.test.ts` (new)
- `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/processing-account.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/request-rows/summary-reads.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/value-readings/settled-rows.ts` (structural witness type only)
- `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/value-readings/summary-readings.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/value-readings/processing-readings.ts` (new private adapter)
- `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/value-readings/tests/processing-catalogue.ts` (new synthetic fixture)
- `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/value-readings/tests/processing-settled.test.ts` (new)

Downstream ownership is this report only. Package versions, architecture documentation and shared working documents are lead-owned changes, excluded from this worker's claims. No shared main, pinned Lab or shared Core tree was edited. No commit or push was made.

## Persistence and trust boundary

Read-only source tracing found no retention changes necessary:

- `runtime/service.ts:2485` processes the ended run's datasets before result verification.
- `storage/project/run-dataset-store.ts` validates/stores the canonical processing declaration, evaluates collected rows via `answerOf`/`processAutomationStudioRecordRows`, and at line470 persists the entire actual account with `JSON.stringify(answer.account)`.
- Its `summaryFromRow` at line594 parses that complete JSON account and assigns it directly to the dataset summary. No field projection strips the optional evidence.
- `result-verification/run-outcome.ts:705` reads dataset summaries unchanged, then `result-summary.ts:450` applies the production processing evidence screen. A JSON round-trip of the new actual producer account is covered by its owning test.
- `record-sets/parse-output.ts` accepts only exact output keys; `process/parse-processing.ts` accepts only `dedupe`, `where`, `sort`, `limit`, `columns`, `minRows`. Neither permits model-authored processing accounts, evaluation context, observations or settlement flags.
- The actual measured runtime summary has its authored visual read and processing declaration. Discovery corrected an earlier table-extraction gap; no node or source-mode fallback was added for that probe.

This is the existing trusted storage/summary boundary, not cryptographic authentication of arbitrary public API callers. The new proof is minted by the actual evaluator and cannot be supplied through the model's record-output grammar.

## Validation observed

Commands below ran only in the nested Core pair. `pnpm` initially resolved to the blocked PowerShell script; subsequent commands explicitly used `pnpm.cmd`.

From `packages/fluxiq`:

```powershell
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/result-verification/value-readings/tests/processing-settled.test.ts
```

Initial reproduction: exit1, 1 failed/1 passed, 41.62s; positive case lacked measured settled rows. Initial implementation: exit0, 2 passed, 35.18s. Final frozen test file: exit0, **14 passed**, 37.16s. The final cases cover actual producer-to-verdict acceptance, missing quotation, nonaffirmative answers, legacy/missing/misaligned/conflicting/malformed proof, denied keys/secrets, duplicate labels, measured absence, relative evaluation clock, unsupported readings and missing authored context.

From `packages/contracts`:

```powershell
pnpm.cmd exec vitest run src/record-sets/process/tests/condition-evidence.test.ts src/record-sets/process/tests/process-rows.test.ts
```

Exit0, **25 passed across2 files**, 1.53s. Actual producer tests cover immutability/deep copies, identical/conflicting/kept duplicate captures, absent/unavailable cells, original numeric semantics, regex flags and recorded date reference.

From `packages/fluxiq`:

```powershell
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/result-verification/value-readings/tests/processing-settled.test.ts src/programs/automation-studio/runtime/result-verification/value-readings/tests/settled-rows.test.ts src/programs/automation-studio/runtime/result-verification/value-readings/tests/summary-readings.test.ts src/programs/automation-studio/runtime/result-verification/value-readings/tests/date-bound-readings.test.ts src/programs/automation-studio/runtime/result-verification/value-readings/tests/empty-and-absent-judge.test.ts src/programs/automation-studio/runtime/result-verification/value-readings/tests/text-settled-judge.test.ts src/programs/automation-studio/runtime/result-verification/request-rows/tests
```

Exit0, **218 passed across26 files**, 38.80s. This run loaded the then13-case processing regression; the subsequently added missing-authored-context case passed in the final14-case focused run above. The same command on the frozen final tree should therefore collect219 cases. An earlier24-file run found the hidden-sort guard regression described above: 203 passed/1 failed; it was fixed before this passing run.

From the nested Core root, `git diff --check` -> exit0, no output. Source sizes remain below limits: processing producer288 lines, types199, processing summary148, request-row summary392; private value-readings directory10 source files. No baseline was changed.

## Not verified by this worker

Lead-owned package types, builds, SDK/declaration portability and structure audit were not run here. Actual persisted-record acceptance and saved runtime responses are being probed independently by discovery/lead; this worker did not read or print those raw rows or responses. No SQL integration, live runtime, provider, installed extension, browser, oracle or replay validation was performed. Both October31 full-suite slots were already used, so no full suite was run.

Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/runtime-verification-evidence/implementation.md`.
