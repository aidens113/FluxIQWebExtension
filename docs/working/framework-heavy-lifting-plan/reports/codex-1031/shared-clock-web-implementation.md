# Shared clock web implementation

Outcome: Done
Changed: t823 downstream source and owning tests listed below; this report in the main checkout.
Validation: `$env:EXTENSION_TEST_BUILD_LABEL='t823-clock'; node scripts/test-extension.mjs content/extraction/tests/order-rows.test.ts content/extraction/tests/item-filter-date.test.ts` (apps/extension) -> 12 tests, 12 pass, 0 fail, exit 0. `git diff --check` (t823 downstream) -> no output, exit 0.
Not verified: Domain tests/type checks await the lead's Core library rebuild as directed. No browser, provider, full suite, or panel run.
Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/shared-clock-web-implementation.md`
Notes: Native extraction consumes typed `host.referenceNow`; direct runtime extraction consumes typed execution-context `referenceNow`. Browser sorting now defaults to the same request instant as filtering. Explicit request instants and absent-context page-clock fallback remain intact.

## Changes

- `domain/src/output-nodes/native-runtime.ts`: remove unsupported `runStartedAt` cast; read SDK host reference.
- `domain/src/output-nodes/extract-list/reference-now.ts`, `index.ts`, `dispatch.ts`: share the existing validated filtered-read injection policy with runtime commands without duplicating extraction reconciliation or changing absent-context behavior.
- `domain/src/runtime/adapter.ts`: consume runtime execution reference before dispatch; preserve the distinct legacy `execute` versus required-command-context entry points. No gateway/type edits required downstream.
- `apps/extension/src/content/extraction/order-rows.ts`: retain explicit apply-time override; otherwise use request `now` before local wall time.
- `domain/src/output-nodes/tests/native-reference-now.test.ts`, `domain/src/runtime/tests/adapter-reference-now.test.ts`: named tests prepared for supplied host/runtime references after midnight, explicit request preservation, and legacy absence.
- `apps/extension/src/content/extraction/tests/order-rows.test.ts`: request-date parity for sorting/filtering after midnight, explicit apply override, and legacy fallback.

## Validation history and pending commands

The first named browser probe reached all 12 tests: 11 passed, the new parity test failed because its fixture assumed calendar-midnight semantics for `yesterday`; Core deliberately reads it as a rolling 24-hour offset. Corrected the fixture's absolute instant to lie between the two possible relative instants; the same 12-test command then passed. Product date semantics were unchanged.

After Core libs are rebuilt, the lead should run named domain tests `output-nodes/tests/native-reference-now.test.ts`, `runtime/tests/adapter-reference-now.test.ts`, `output-nodes/extract-list/tests/dispatch-run-now.test.ts`, plus existing native/runtime adapter checks, package type checks and structure audit under its validation coordination.

## Replay metadata follow-up

Outcome: Done (source prepared; generated domain execution remains held).

- Added `referenceNow?: number` to the actual `executeTool` request owner, `domain/src/runtime/llm-evidence/capture.ts`. The runtime's `tools.ts` passes executeTool input unchanged into `WebNodeRun`; its unrelated capture-only request constructor explicitly leaves the reference absent. `harness-options/execute.ts` preserves optional Core harness metadata when constructing its own request.
- `node-run/retries/dispatch.ts` consumes request metadata at the shared actual gateway dispatch boundary. Both replay and authoring use this function, and retries retain the same injected reference. It clones parameters instead of modifying model-authored input. No schema/model field was added.
- `extract-list/reference-now.ts` now also injects for sort-only reads, and rejects references beyond JavaScript Date's maximum epoch (`8.64e15`), alongside existing safe-integer/nonnegative validation. Ordinary unsorted/unfiltered reads remain unchanged.
- Added named coverage in `node-run/tests/replay.test.ts` that calls the binding-compatible runtime executeTool API with metadata and inspects the actual browser extraction command after midnight; includes explicit request override and absent metadata. Expanded `dispatch-run-now.test.ts` for sort-only reads and maximum epoch acceptance/rejection.

Validation: `git diff --check` -> no output, exit 0. Source review confirmed both exhaustive `present<WebLlmEvidenceToolRequest>` constructors account for the new optional field. No additional generated tests, domain builds, types, full suites or live browser/provider calls ran under the hold. The earlier 12/12 browser result remains the last executed test result. Lead should add `runtime/llm-evidence/node-run/tests/replay.test.ts` to its named validation after rebuilding Core.
