# t375 — packed draft measurement support

## Verdict

Complete. The draft diagnostic now measures both the legacy object-per-step
representation and the exact self-describing `step_rows_v1` representation.
Packed rows with a `null` input cell are counted as inputs withheld for budget,
while a malformed or unknown packed declaration throws instead of producing a
misleading zero-omission diagnostic.

## Files changed

- Core `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/draft-shown.ts`
  - Recognizes only the closed `step_rows_v1` format and exact ten-field schema.
  - Validates each row's seven required cells and up to three declared optional
    trailing cells before measuring it.
  - Counts packed `null` input cells as `withoutInput`.
  - Preserves legacy object-line measurement, including `inputTooLarge`.
  - Fails closed on unknown formats, missing/reordered schema metadata, array
    rows without a format, malformed cell values, short rows, and extra cells.
- Core `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/draft-shown.test.ts`
  - Adds producer-backed coverage for complete packed entries and packed input
    withholding.
  - Adds table coverage for seven malformed or unknown packed shapes.
- Downstream `docs/working/mvp-today-plan/reports/t375-draft-measurement-support.md`
  - This worker report only; no shared plan was edited.

## Validation

- Passed: `pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/llm/evidence-loop/tests/draft-shown.test.ts`
  - 1 file passed, 14 tests passed.
- Passed: `pnpm --filter fluxiq check`
  - TypeScript completed with no errors.

No provider or live run was invoked. I did not edit the flow-draft entry, service
fixture, or shared working documents, and I did not commit or push.
