# t194-w53: empty diagnosis text reads as omitted

## Outcome

Done. An empty or whitespace-only diagnosis `expected`/`observed`/`changed` is now accepted and left out of the parsed diagnosis. A too-long or non-string text is still refused with `llm_output.invalid_diagnosis_text`.

Commit message: `Core: read an empty diagnosis text as omitted, not invalid (live run muqk713g, C2)`

## What changed and why

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`, R/ = `packages/fluxiq/src/programs/automation-studio/runtime/`:

- `R/llm/harness/provider-result.ts`
  - `validateUnknownDiagnosisFields` now skips a blank string (`isBlankText`: a string whose trim is empty). It no longer refuses an empty string. The length check (> `AUTOMATION_STUDIO_LLM_DIAGNOSIS_TEXT_MAX_LENGTH`) and the non-string check are unchanged.
  - `parseAutomationStudioLlmStructuredResponse` used to return the raw provider object. For a `diagnosis` response it now returns `{ ...value, diagnosis: withoutBlankDiagnosisText(value.diagnosis) }`. That copy has the blank text fields deleted, and the provider's raw reply is not mutated. `stripAutomationStudioLlmResponseMetadata` then carries the copied diagnosis through as before.
  - Added a shared `DIAGNOSIS_TEXT_FIELDS` constant.
- `R/llm/harness/tests/empty-diagnosis-text.test.ts` (new):
  - `""`, `"   "` and `"\n\t"` are accepted, and they are absent from the parsed diagnosis. The test also asserts that the raw reply still holds `changed: ""`.
  - A 501-character text, `3` and `null` are still refused.

Consumers checked (all tolerate an absent field and already ignored blanks):
- `R/result-verification/verdict.ts:113-130` spreads only when the field is defined, and `changed` is trim-checked.
- `R/llm/harness/context-packet.ts:384-390` uses `text()`, which is trim-checked.
- `R/recovery/structured-diagnosis.ts` `boundedText` returns undefined for undefined and for blank.

## Commands run and observed results

- Failing-first test on HEAD source: `heavy.sh "t194-w53 failing-first" npx vitest run .../llm/harness/tests/empty-diagnosis-text.test.ts` -> 1 failed, 1 passed: `"": expected [ …(2) ] to not include 'llm_output.invalid_diagnosis_text'`.
- After the fix: `heavy.sh "t194-w53 vitest" npx vitest run src/programs/automation-studio/runtime/llm/harness src/programs/automation-studio/runtime/result-verification` -> `Test Files 49 passed (49)`, `Tests 426 passed (426)`.
- `heavy.sh "t194-w53 check" pnpm check` (packages/fluxiq) -> rc=0 (tsc --noEmit).
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (218 warning(s), 349 baselined).`

## Not verified

- No live run and no provider call.
- The full Core suite was not run.
- Other workers are editing `R/result-verification/**` concurrently, so the run above reflects their state at that moment.

## Open questions or contradictions found

- `R/llm/deepseek/output-schema.ts:23-25` still declares `minLength: 1` on the three diagnosis texts. I did not own it and did not touch it. With strict schema enforcement a provider could not send `""`. In practice it did (muqk713g). The supervisor may want that schema relaxed, or left as a hint now that the parser tolerates blanks.
