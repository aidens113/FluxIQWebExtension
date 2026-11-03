# Runtime affirmative-judge hold

Outcome: Done — read-only discovery; no production source changed.

## Measured failure

Finalized run `run-mvx83b7v-5eda5d6c` completed native execution successfully and passed its dataset oracle. Final lane fields are `status: succeeded`, `failure: null`, `resultVerification: unverified`, `reportedVerdict: unverified`; evaluation failed `runtime.behavior`.

The six judges are not six retries of one check. Finalized52/53 are the build-test confirming pair; the second asks the normal converse question. Runtime66–69 are two checks, each using its first ask plus one exclusion-evidence correction. All four runtime replies have `answersRequest: yes`, zero defects and eight checked cells. All four retained result-check validations have `validationOk: true`, `validationCodes: []`. This is **not a response-schema failure**.

Requests67/69 explicitly carry Core's missing-exclusion-evidence correction. Production pure-reader replay of the four saved runtime summaries/replies yields:

| Finalized judge | Code | Remaining non-bound groups | Refuted citations |
| --- | --- | --- | --- |
| 66 | `core.result.exclusion_evidence_missing` | condition1:4 rows; condition2:7 rows | 0 |
| 67 | same | condition2:5 rows | 0 |
| 68 | same | condition1:4 rows; condition2:7 rows | 0 |
| 69 | same | condition2:6 rows | 0 |

Every result is `unsure` / `model_unconfirmed`. These counts are the offline production reader's result on the **retained formatted judge-copy summary**. It is not a reconstruction of the unscreened original runtime summary: exact correction-line equality is false and is reported by the probe rather than hidden.

The remaining row identities are present in the prose, by Core's own row matcher. They also occur on lines with a valid verbatim request quote, but **none** of the remaining5/6 rows has a valid request quote in its own parsed sentence. The guard's same/adjacent-sentence rules do not accept those associations; a quotation already associated with another row is not lent onward. This establishes the rejected obligation, not a lexical quotation-parser false negative. `diagnosis.checked` is not exclusion proof: its eight entries cite kept cells, and `reply-text.ts` intentionally reads only expected/observed/changed/summary for this separate prose guard.

## Why processing exclusions never became Core-settled

The actual runtime read is unfiltered:76 collected/kept across four pages. The saved record-output processing keeps8. Its two processing conditions expose four and seven distinct displayed left-out labels, respectively.

The native-read path can settle an exclusion using aligned, observed tested-cell evidence. The processing path cannot:

- Public `packages/contracts/src/record-sets/process/types.ts:118` defines an excluded row as `{ field, label }`; `:131` defines its condition account. Neither preserves that row's tested cell or typed test.
- Producer `packages/contracts/src/record-sets/process/process-rows.ts:136` owns the typed condition, actual collected rows, `cellOf` and run-relative time, but `:158` appends only the label. This is the correct evidence-producing seam.
- `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/processing-account.ts:76` screens and forwards those labels/counts/wording. No tested-cell observation exists to forward.
- `request-rows/summary-reads.ts:208` carries native observations and settled rows. Its processing counterpart at`:252` explicitly passes `settled: undefined` and no witnesses. Therefore processing conditions remain row-by-row semantic obligations even where Core could compute the typed predicate on its own observed record value.
- `value-readings/settled-rows.ts` already owns generic bound/presence/text settlement semantics. A missing, withheld, unavailable or misaligned witness must continue to settle nothing.

This is a typed evidence gap in the Core processing path. It does not justify accepting the judge's assertion, accepting checked kept cells as exclusion authority, or weakening required request/condition wording. Capture the actual tested value and typed predicate at the existing processing producer; screen and propagate it; compute settlement through the existing semantics. Preserve the one request quotation naming the condition, including when a condition's values have been settled.

## Owning paths and compatibility

Likely production ownership: contracts `record-sets/process/types.ts`, `process-rows.ts`; Core `result-verification/processing-account.ts`, `request-rows/summary-reads.ts`, and a focused reuse of `value-readings/settled-rows.ts`. Necessary narrow barrels belong with those modules. `storage/project/run-dataset-store.ts:470` persists the processing account as JSON; additive optional fields should preserve old accounts as **unmeasured**, without a SQL migration. Verify the actual account reader/normalizer retains new optional fields. Public contract additions need synchronized exports/builds and the normal package compatibility/version handling.

Existing owning tests: contracts `record-sets/process/tests/process-rows.test.ts`, `value-reading.test.ts`, `row-identity.test.ts`; Core `result-verification/tests/result-summary.test.ts`, `verdict.test.ts`, `request-rows/tests/unquoted-rows.test.ts`, `value-readings/tests/settled-rows.test.ts`; persistence `storage/project/tests/run-dataset-store.test.ts` if serialization changes. Add focused processing-account/processing-condition tests at their owning `tests/` directories when needed. Cover actual absent/present values, typed predicates, alignment, duplicate labels, withholding/unavailable evidence, legacy accounts, and quote obligations that remain unsatisfied.

Structure limit is800 source lines, advisory400 (`scripts/structure-audit/context.mjs:46`). Current measured sizes: types188, producer260, processing-account97, summary-reads385, settled-rows261. Keep new cohesive work in focused modules rather than growing summary-reads across its advisory threshold.

Judge ownership: `result-verification/verdict/result-verdict.ts:65` constructs the held yes; `verify.ts:285` sets two asks per check; `:397` requests missing-evidence correction within that allowance; `agreement/agree.ts:38` preserves missing evidence as unconfirmed. `request-rows/unquoted-rows.ts:185`, `:302`, `:371` own row/quote association. No loop or purse change is indicated.

## Retained provider-free production probe

Ignored helper: `test-runs/2026-10-31-t841-validation/probe-saved-judge-exclusions.mjs` in the nested t841 downstream tree. Arguments are finalized run directory and Core root. It imports only Core's production pure verdict/wording/row readers, reads saved JSON, and emits codes/counts/booleans. It opens no store, runtime, browser or provider.

```powershell
node --no-warnings test-runs/2026-10-31-t841-validation/probe-saved-judge-exclusions.mjs C:/Users/osrs_/FluxStuff/lab-runs/2026-10-31/run-mvx83b7v-5eda5d6c C:/Users/osrs_/FluxStuff/fxlab/t833-claude/!FluxIQ
```

Validation: exact command -> exit0, four closed JSON lines with the table's held code/counts; no observed-cell/settled-row fields in either processing condition. `git check-ignore -- test-runs/2026-10-31-t841-validation/probe-saved-judge-exclusions.mjs` -> path printed, exit0. No source tests/builds or state mutations ran.

Not verified: private pre-format runtime-summary equality; a complete per-row sentence parser defect; post-fix actual producer evidence or acceptance. The next acceptance probe must recover the real declaration/schema/collected rows and run production processing, screening, summary and verifier; it must not inject witness or settlement fields into a recorded summary.
