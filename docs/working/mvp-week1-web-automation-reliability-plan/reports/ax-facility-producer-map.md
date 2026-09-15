# `ax-facility-producer-map` — runner propagation map

## Outcome

The new evaluation contract should be propagated through three serial seams:
produce one closed diagnostic at the scenario boundary, make both evaluation
producers require it, then make campaign projections derive their durable
diagnosis from the immutable evaluation. The implementation is downstream-only;
it needs no Core, extension, receipt, or checkpoint field.

The present loss points are exact:

- `run-scenario.ts:377-395` safely narrows several caught errors for the event,
  but `singleRunEvaluation` receives only `{ sequence, trigger }` at
  `run-scenario.ts:512-515`.
- `evaluateFailedAttempt` classifies a raw outer error but stores no diagnostic
  (`bench/evaluate-run.ts:110-133`).
- `run-bench.ts:252-257` persists the raw thrown message only in mutable
  `runs.json`; after restart `validateCompleted` reconstructs solely from the
  immutable evaluation (`run-bench.ts:289-302`), and `recordFromEvaluation`
  consequently loses that message (`run-bench.ts:509-512`).
- finalized-bundle reconciliation reconstructs the evaluation at
  `run-bench.ts:343-350`; unless it copies `source.facilityFailure`, it will erase
  the new field even though `readRunBundle` parsed it.

## Required ordering

1. Land the test-contracts 0.2 writer and explicit 0.1 normalization first.
2. Land the closed projector/stage wrapper and scenario wiring.
3. Land the shared evaluation-producer changes.
4. Land campaign persistence, resume, aggregation, and rendering together.
5. Bump bench semantics and run all focused tests before any Lab run.

Steps 2 and 3 are logically serial: the evaluator needs the projector's value.
The campaign worker can prepare against the contract, but its final integration
must follow the producer changes. No two workers below own the same file.

## Partition A — closed projection and scenario stages

Own only:

- `packages/test-runner/src/facility-failure/project-facility-failure.ts` (new)
- `packages/test-runner/src/facility-failure/projected-facility-error.ts` (new)
- `packages/test-runner/src/facility-failure/index.ts` (new barrel)
- `packages/test-runner/src/facility-failure/tests/project-facility-failure.test.ts` (new)
- `packages/test-runner/src/failure.ts` and its owning test
- `packages/test-runner/src/run-scenario.ts`
- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`

Implementation:

- `projectFacilityFailure(error, boundary, stage)` returns exactly
  `RunEvaluation["facilityFailure"]`: the supplied closed boundary/stage, a
  contract-enumerated reason, and only contract-allowed `operationStage`,
  `causeCode`, or `timeoutMs`. Import the contract's exported enums/types; do
  not copy their string unions.
- Reuse the already closed projectors rather than spread `error.details`:
  `finalizedRecordingWaitFailureDetails`, `pairingStatusWaitFailureDetails`,
  `httpTransportFailureDetails`, and `topologyReadinessFailureDetails`. Map only
  fields admitted by the 0.2 contract. Pairing status, recording ids, paths,
  URLs, messages, bodies, and arbitrary nested cause data never enter the
  evaluation.
- Move or export the bounded Node/transport cause-code selection so
  `classifyRunnerFailure` and the new projector share one allowlist. Do not add
  a second `ENOENT`/module/socket list. Unknown input becomes the contract's
  literal `unclassified` reason with no raw fallback.
- `ProjectedFacilityError` wraps the original error for stack/causality in the
  live process but exposes a readonly validated diagnostic. Its projector must
  be idempotent so an already wrapped error is not relabelled at a later stage.
- Keep `runScenario` as the public wrapper and rename its current body to a
  private implementation accepting a tiny stage setter. The wrapper catches an
  escaping error and throws `ProjectedFacilityError` with boundary
  `no-final-bundle`. This avoids indenting or moving the roughly 500-line body.
- Advance the coarse stage immediately before each irreversible boundary:
  scenario manifest/workflow resolution (`scenario.load`, current lines 56-77),
  bundle construction/initialize (`bundle.initialize`, 87-88), main execution
  (`scenario.execute`, before 127), cleanup (`scenario.cleanup`, before 396),
  and manifest/evaluation/receipt/finalize publication (`bundle.publish`, before
  485). A thrown stage always names the operation that was attempted, not the
  last one completed.
- Add `let facilityFailure = null` beside `failureCategory`. In the main catch,
  project the primary caught facility error with boundary `finalized-bundle`
  and the current stage. When cleanup supersedes a successful/absent primary,
  replace the diagnostic at the same point the existing precedence rule replaces
  category/message; when cleanup is secondary, preserve the primary diagnostic.
  Pass this value to `singleRunEvaluation` at current lines 512-514.
- Existing/clone targets still produce no `RunEvaluation`; the escaping wrapper
  may carry a diagnostic to their caller, but must not invent an evaluation.

Tests:

- Table-test every contract stage and both boundaries; known HTTP timeout,
  HTTP transport, topology readiness, module/path denial/missing, and unknown
  causes map to the exact closed shape.
- Inject a unique sentinel into `message`, URL/path/body/credential-shaped
  properties, nested causes, getters, and foreign codes. JSON of the projection
  must contain none of it; getters/proxies must fail closed to `unclassified`.
- Mutation checks: widening a raw spread, accepting an unknown code, failing to
  advance a stage, or overwriting a primary failure must fail.
- Extend `runner-wiring.test.ts` to pin stage order, the single projection passed
  to `singleRunEvaluation`, and primary-over-cleanup precedence. Keep this as a
  wiring test; projector behavior belongs in the new feature's tests.

## Partition B — both evaluation producers

Own only:

- `packages/test-runner/src/run-evaluation/observed-run-evaluation.ts`
- `packages/test-runner/src/run-evaluation/single-run-evaluation.ts`
- `packages/test-runner/src/run-evaluation/tests/single-run-evaluation.test.ts`
- `packages/test-runner/src/run-evaluation/tests/bench-parity.test.ts`
- `packages/test-runner/src/bench/evaluate-run.ts`
- `packages/test-runner/src/bench/tests/evaluate-run.test.ts`

Implementation:

- Add required `facilityFailure: RunEvaluation["facilityFailure"]` to
  `ObservedRun`; write it at `observed-run-evaluation.ts:66-99`. Do not default
  it there—requiring every producer to state `null` prevents a future producer
  silently omitting the field.
- Add the same required input to `SingleRunInput` and pass it unchanged through
  `singleRunEvaluation` to `evaluateObservedRun`.
- Add it to `RecordingRunInput`; `evaluateRecordingRun` and `evaluateFlowRun`
  pass it unchanged. Ordinary successful runs and expected automation outcomes
  pass `null`.
- Change `evaluateFailedAttempt` to accept an already projected no-final-bundle
  error/diagnostic and require non-null `facilityFailure`. It may continue using
  `classifyRunnerFailure` for the orthogonal `failureCategory`, and it keeps the
  current inconclusive verdict, empty actions/evidence, and null automation
  observations. It must never derive durable text from `error.message`.
- The contract owns invalid verdict/diagnostic pairings; leave the final
  `assertRunEvaluation` in `evaluateObservedRun` as the common enforcement point.

Tests:

- Every existing fixture builder explicitly supplies `facilityFailure: null`
  and expects schema 0.2.
- A finalized HTTP/readiness diagnostic survives `singleRunEvaluation`, JSON
  serialization, and the 0.2 parser field-for-field.
- A passing run plus non-null diagnostic is rejected. An expected automation
  failure has `facilityFailure: null`.
- `evaluateFailedAttempt` preserves a projected no-final-bundle diagnostic,
  remains inconclusive, and has no actions/evidence/automation verdicts.
- Bench/single parity compares `facilityFailure` as part of the full evaluation.
  Mutations dropping it from either producer must fail.

## Partition C — finalized reconciliation and durable campaigns

Own only:

- `packages/test-runner/src/bench/run-bench.ts`
- `packages/test-runner/src/bench/report-store.ts`
- `packages/test-runner/src/bench/failure-cause.ts`
- `packages/test-runner/src/bench/render-markdown.ts`
- their owning tests under `packages/test-runner/src/bench/tests/`
- `packages/test-runner/src/bench/campaign/identity.ts`
- `packages/test-runner/src/bench/tests/campaign-store.test.ts`

Implementation:

- In both resumable (`run-bench.ts:252-257`) and legacy (`407-410`) outer
  catches, obtain the diagnostic only from `ProjectedFacilityError`; an
  unwrapped injected error is projected once at `bench.persist` as an
  unclassified no-final-bundle failure. Pass that closed value to
  `evaluateFailedAttempt`.
- Stop persisting `describeError(error)` as the synthetic run's `failureCause`
  or `problems`. This is the current campaign-directory leak at lines 255 and
  409. Use a deterministic rendering of `evaluation.facilityFailure`; never the
  thrown message.
- In `reconstructBenchEvaluation` (`343-350`), pass
  `facilityFailure: source.facilityFailure` into either lane evaluator. This is
  mandatory for a finalized bundle reconciled after a crash.
- `validateCompleted` already authenticates evaluation bytes before parsing
  (`289-301`). Strengthen `assertCaughtRunnerEvaluation` (`506-508`) to require
  `boundary: no-final-bundle` in addition to the inconclusive invariant. This
  prevents a bundle-less cell with a normalized legacy null diagnostic from
  being accepted.
- Add required nullable `facilityFailure` to evaluated `BenchRunRecord`s and set
  it from the evaluation in both `recordRun` and `recordFromEvaluation`. Skipped
  records omit it. `runs.json` remains a projection; the immutable evaluation
  and its checkpoint digest remain authoritative.
- Group/render facility failures from this typed field. A concise label should
  contain only boundary, stage, reason, and present optional closed fields.
  A finalized bundle's redacted one-line event summary may remain local
  troubleshooting text, but it must not override the typed diagnostic and a
  synthetic run must never copy raw thrown text into campaign projections.
- The aggregate `BenchReport` metrics need no schema field: diagnostics are
  per-run facts, represented in `runs.json`, the terminal outcome, and Markdown.
  `aggregate-report.ts` and comparison math therefore require no production
  edit; tests only need 0.2 fixtures with `facilityFailure: null`.
- Bump `BENCH_SEMANTICS_VERSION` in `campaign/identity.ts` from 0.2 to 0.3.
  This makes paused old campaigns fail closed before mixing 0.1 and 0.2
  evaluations. Do not change campaign/checkpoint/receipt schemas: the existing
  evaluation SHA-256 authenticates the new field.
- `load-report.ts` needs no logic change because `parseRunEvaluationJson`
  performs explicit 0.1-to-0.2 normalization. Update its tests, if any fixture
  asserts exact evaluation JSON, to expect normalized 0.2 plus null.

Crash/resume test (extend `bench/tests/run-bench.test.ts`):

1. Use one executable cell and a fake runner that throws a
   `ProjectedFacilityError` whose raw error carries a unique secret sentinel.
2. Crash exactly at `after-completion-checkpoint`, after the immutable synthetic
   evaluation and its digest exist but before aggregate projections finish.
3. Read and retain the parsed immutable evaluation, resume the same campaign,
   and assert the runner call count is still one.
4. Assert the resumed evaluation, `runs.json`, terminal `failureCauses`, and
   Markdown all carry the identical closed diagnostic.
5. Recursively scan files **inside the campaign directory only** as bytes and
   assert the sentinel is absent. Also assert no message/path/URL/body/credential
   key exists in the diagnostic.
6. Resume a second time and assert idempotent diagnostic/projection output apart
   from the existing generated timestamp allowance.
7. Add a negative bundle-less checkpoint fixture with normalized legacy
   `facilityFailure: null`; resume must reject it rather than accept a mixed
   historical shape.

Also extend the existing finalized-bundle `after-bundle-finalized` crash case to
give the bundle evaluation a non-null finalized diagnostic and prove it survives
reconstruction and the completion checkpoint unchanged.

## Validation boundary

Run only focused package checks/tests while implementing: the contract tests,
facility-failure tests, run-evaluation tests, bench evaluator tests, campaign
store tests, and `run-bench.test.ts`; then the test-runner package check/test.
Mutation-prove raw-spread rejection, required producer wiring, reconstruction,
and no-final-bundle resume. Do not run the Lab or corpus until all focused tests
pass. This map changed only this report; it inspected no campaign artifacts,
page data, logs, or secrets and ran no tests, commit, or push.
