# Shared reference clock: Core discovery

Outcome: Done (read-only discovery; no source changes or tests).

## Recommendation

Use an optional epoch-millisecond `referenceNow` in execution context, separate from the live `now()` timer. Capture it once at the enclosing run/trial boundary from existing `startedAt`, pass it through dispatch and deterministic result normalization, and retain wall-clock fallback for legacy callers. Do not freeze `options.now`: retries, deadlines, duration accounting and cancellation use it.

Normal runtime and candidate trials already have suitable timestamps; no model-authored request/input change is necessary. There is no existing end-to-end shared reference: persisted dataset processing uses the session start, while browser dispatch has no timestamp context and several judge readers use wall time.

## Concrete seams (paths relative to t823 Core)

- `packages/fluxiq/src/programs/automation-studio/runtime/executor/contracts.ts:679`: `AutomationStudioGraphExecutionOptions`, with live `now?: () => number` at 704. Add optional `referenceNow?: number`; preserve it across nested options and seeds. `effectDispatcher` context at 727 and `nativeNodeExecutor` request/hostContext at 750 are the additive, non-model-facing dispatch seams.
- `runtime/executor/graph-run.ts:147,293`: graph start is `seed?.startedAt ?? now()`. Establish the effective reference before constructing run state/executing a frame, using supplied reference then seed start then newly captured start. `AutomationStudioGraphRunSeed` at 104 already preserves start across resume. The outer fault wrapper and inner trace separately sample time today, so choose one boundary reference rather than relying on their samples being equal.
- `runtime/executor/node-execution/attempt.ts:148`: populate native executor context. Effects pass `effectDispatchContext(...)` at 274; add the reference to that helper's context and its declared type. Composite calls already receive full graph options (contracts.ts:744), so additive propagation fits the existing seam.
- `runtime/service/candidate-trial/run.ts:168` and `runtime/service/subflow-trial/run.ts:196`: capture and write session `startedAt` before detached execution. Pass this exact value through graph options and trial summary. `flow-bootstrap/verification/detached-execution.ts:40` samples its own later receipt start, and detached subflow/from runners do likewise; do not let those later samples overwrite the enclosing trial reference.
- `storage/project/run-dataset-store.ts:253,465`: existing `processRunDatasets()` reads `runtime_runs.started_at_ms` unless explicit `options.now` is supplied. This already anchors normal/trial stored answers correctly. Preserve this contract; explicit processing `now` intentionally wins. No storage schema change is needed for ordinary runs.
- `runtime/result-verification/run-outcome.ts:559`: `summarizeAutomationStudioRunResult()` is called without its supported numeric `now`. Supply session reference/start. Candidate counterpart `runtime/service/candidate-trial/summary.ts:67` also omits it; caller has `startedAt` even when trace is missing.
- `runtime/result-verification/build-test/summary.ts:297`: `automationStudioBuildTestStores()` supports numeric `now`, but caller omits it. `stores.ts:140` therefore samples `Date.now()`, causing answer filtering/sorting drift. The report/input types at summary.ts:151 and `runtime/llm/node-tools/dry-run-gate.ts:148` carry no timestamp today.
- `runtime/llm/node-tools/dry-run-gate.ts:292,363,381`: capture one reference at fresh replay entry, save it with `clean` and report, and propagate it to replay tool dispatch. Reuse reports must retain the clean replay's reference, just as they retain its observations/start/end views. `runtime/service/flow-bootstrap-commands/build-judge.ts:141` has the report and must pass its reference into build summary.
- Further judge drift: `result-verification/computed-facts/order.ts:46` samples `Date.now()`; `agreement/record-contradictions.ts:31` calls order checking without its supported `now`; `value-readings/condition-readings.ts:54`, `settled-rows.ts:156`, `order-claim.ts:51` have wall-clock defaults. Propagate the effective reference through their owners rather than changing low-level relative-date semantics. `verify.ts:247`'s optional `now()` currently reaches the provider harness at 479, so it is a live timer, not an adequate substitute for a stable date reference.

## Run semantics

- Fresh Flow run, fresh candidate/subflow trial, fresh build replay: obtain a fresh reference from that execution's own enclosing start, even when the Flow signature is unchanged.
- Cached clean replay/rejudgement: retain the original replay reference; merely asking a judge later must not reinterpret the same relative rows against a new day.
- Resume and continuation/repair from a failing step within the same execution: retain original reference. Child Flow/subflow calls inherit it rather than sampling their own starts.
- A whole rerun that reuses a run ID needs explicit policy: current refuted-result loop says it reuses that ID (`run-outcome.ts:395`) and storage looks up that run's start. Treat a genuinely new whole execution as fresh only if session start/reference is advanced consistently for dispatch, datasets and summary. Run ID alone cannot decide reference freshness. No automatic change to repair identity is recommended.

## Existing tests to extend (not executed)

- `storage/project/tests/run-dataset-store.test.ts:417`: already tests relative dates against run start and explicit override; retain it as the persistence contract.
- `executor/tests/resume.test.ts:134`: already expects resumed trace start to match parked trace start; add dispatch-reference inheritance while live timer advances.
- `llm/node-tools/tests/dry-run-gate.test.ts:353`: exact cached reuse report expectation; add reference preservation and fresh changed/replayed draft coverage.
- `service/flow-bootstrap-commands/tests/build-judge.test.ts`, `result-verification/build-test/tests/stores.test.ts`, `result-verification/value-readings/tests/date-bound-readings.test.ts`, `result-verification/read-account/tests/date-bound-condition.test.ts`: add a crossing-midnight case with absolute row timestamps and relative bounds; verify shared reference prevents changed membership.
- `contracts/src/record-sets/process/tests/date-bound.test.ts`, `process/condition/tests/date.test.ts`, `process/tests/value-reading.test.ts`: existing semantics/parity tests; no grammar changes should be required. `processAutomationStudioRecordRows` already requires numeric `now` (`process-rows.ts:88`).
- Candidate/subflow runner owning tests should assert persisted session start equals dispatch and summary reference, including a delayed detached start and missing trace.

Validation: source inspection with `rg` and `Get-Content`; no tests, API calls, browser work, git mutations or source edits.
Not verified: runtime behavior, complete normal service graph-options wiring, browser wire propagation, and every judge agreement caller. The concrete seams above were inspected; implementation still needs focused caller tracing and validation.
