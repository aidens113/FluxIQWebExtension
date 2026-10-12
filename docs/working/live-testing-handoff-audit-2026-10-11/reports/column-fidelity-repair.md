# Column fidelity repair
Status: Active
Created: 2026-10-12
Last updated: 2026-10-12
Owner: B-debug worker

## Current State
Nested t461 bootstrap-complete/root clearance received. B owns output schema reconciliation and nearest tests only; A owns disjoint extraction observation producers/wire, C Core projection. No package-wide validation until source freeze. Neutral fail-first owner/dispatch cases added; waiting for stable extraction import window before execution.

## Work Ledger
- Read main Current State/written brief/retained t451 exclusion audit and named output owners. Actual authored order was correct; derived schema rebuilt in extraction field insertion order. No extraction row/filter changes proposed.
- Added tests to existing reconciled-record-output.test.ts and declared-columns.test.ts: insertion alpha/beta/gamma vs authored gamma/alpha/beta, extraction types/labels/required flags/process fidelity, missing/unknown/duplicate-order legacy fallback, actual subset/helper/excluded dispatch and stored field order. No fixture task or model guidance.
- Planned owner reconciliation preserves valid unique known authored ID order, then any remaining derived helper/excluded fields in original order. Invalid/no authored order retains prior derived behavior. declared-columns.ts/record-output.ts need no change.

- Actual fail-first17tests/2files:2failed/15passed, native1. Both neutral schema/dispatch order assertions failed; legacy fallback passed. Reconciliation-only repair added; unchanged extraction fields/values/filter/processing. Focused final owner tests running while A holds imports stable.

## Stable scoped repair
Only reconciled-record-output.ts product code changed. Derived field contracts still own valueType/required/handling and label validation. A valid unique list of known authored schema ids now decides kept column order; undeclared retained sort/dedupe helpers and excluded fields follow in prior derived order. Missing/empty/unusable authored order keeps field-map order. Neither request field order nor predicate/filter values, read/row order, output processing or data changes.

Existing declared-columns.ts and record-output.ts remain unchanged. In particular, legacy unknown-name normalization is pinned by existing tests; this repair does not silently reinterpret that established fallback as a new refusal. Existing unsupported record-output keys/encryption/invalid-request/refusal gates remain covered by nearest issue/dispatch tests. Duplicate unusable order likewise falls back without adding or coalescing columns.

## Exact validation to date
Stable source window was agreed with A before tests; A held producer/wire mutations. Native owning commands use DOMAIN_TEST_BUILD_LABEL t461-column-fail-first and t461-column-owners respectively; normal Core freshness gate passed each.
- Fail-first: pnpm.cmd --filter @fluxiq-web-extension/domain test output-nodes/extract-list/tests/reconciled-record-output output-nodes/extract-list/tests/declared-columns.17tests:2failed/15passed, native1. Both actual authored-order assertions failed before source repair.
- Final nearest owner check adds output-nodes/extract-list/tests/record-output-process, derived-record-output, issues, dispatch-alone-rows filters.38tests/6files pass, native0; no skip/cancel. Actual dispatch schema/stored-record column order, subset/sort helper/exclusion/predicate rewrite and existing processing/refusal/derived behavior covered.
- Source/tests stable and all checks idle; A notified source-import hold released. No whole package types/build/native audit while A mutates producers. Final combined gates await source-freeze/owning Core freshness signal.

## Changed paths
- domain/src/output-nodes/extract-list/reconciled-record-output.ts
- domain/src/output-nodes/extract-list/tests/reconciled-record-output.test.ts
- domain/src/output-nodes/extract-list/tests/declared-columns.test.ts
Own report only; no shared-doc/Core/wire/producer/dispatch source changes or new files beyond this report. No provider/browser/panel/full suite/commit/merge/lifecycle or oracle/model guidance modification.

## Architecture text owed to supervisor
Extraction determines stored field types, required flags and exclusion handling; a valid authored record schema determines column presentation order. Reconciliation retains authored labels/order over those derived contracts. Fields retained for collection processing and explicit exclusions follow in their existing derived order. Missing or unusable authored order retains the existing field-map fallback. This repairs a proven downstream order substitution and makes no semantic judge/goal completion claim.

## Supervisor acceptance

Root independently inspected source and observed Core72/domain78/extension83 owning tests, all cache-free affected typechecks and both native audits passed. Headed Chrome134 T2 packet/hash/DOM/schema-order checks passed independently; no background transport, model verdict, continuation or live withholding claimed. Current-dev integration and combined-source narrow gates still required before publication.
