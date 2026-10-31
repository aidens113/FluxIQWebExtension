# t826 host audit repair — source frozen

Outcome: Done (requested source repairs complete; lead owns generated acceptance).

Changed:
- `domain/src/runtime/host-failure/carried.ts`
- `domain/src/runtime/host-failure/tests/failure.test.ts`
- `domain/src/runtime/llm-evidence/tool-rejection.ts`
- `domain/src/runtime/llm-evidence/tool-rejection/{carrier.ts,index.ts,tests/carrier.test.ts}`
- `domain/src/runtime/llm-evidence/node-run/retries/tests/transient.test.ts`

## Failed gate and exact repair

Lead's Down structure audit exited 1 with three named issues:

1. `contract-spread` at transient-test lines 16/87: replaced call-result spreads with explicitly typed, named control fields. Existing named typed spreads remain.
2. `failure-as-empty` at carried-reader catch: narrowed the catch to own-property descriptor access alone and return a named conservative classification, `UNKNOWN` / `ambiguous_or_unknown` / `retryable:false` / `stage:execution` / `effect:ambiguous`. No transient/unacted admission, private data, getter invocation, exception propagation or executed-call erasure is introduced. Ordinary absent/accessor/malformed optional records retain their existing behavior. The inspected owning throw wrapper turns this truthful record into its existing failed action result; ordinary unclassified throws still use its unknown acknowledgement result.
3. `file-lines` at `tool-rejection.ts` (804 > 800): extracted the complete recoverable-refusal carrier responsibility into its own module and directory barrel, with the original import surface re-exported for identity compatibility. The constructor still projects optional failure before any catch/serialization can inspect it. The original file is now 783 lines. No limits or baselines changed.

## Prepared regressions

- Host descriptor proxy throws preserve an explicit ambiguous nonretryable classification without private text.
- Actual replay-reset dispatch with unreadable optional metadata retains the dispatched call, failed result, evidence, `effectApplied:false`, absent person flag and conservative projected controls.
- Extracted carrier preserves original class identity, person flag and optional-control projection; comparisons/digest never enter the constructed error, original input stays untouched, malformed optional fields do not alter actual refusal flags.

Validation: source inspection/line-count command -> original tool rejection 783 lines, extracted carrier 27 lines; prohibited call/literal-spread search -> no matches (rg exit 1).

Not verified: generated Down tests/types/build and structure audit were deliberately not run under the lead's hold. Lead must include `runtime/llm-evidence/tool-rejection/tests` alongside the already planned host/retry tests. No Core, git, shared working state, browser, panel, provider or runtime-state operations performed.

Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/p8-transient/host-fix.md`

Notes: Source freeze announced to lead with exact changed paths. The generic ambiguous record is the lead-approved fail-closed option and deliberately proves no safe repetition.
