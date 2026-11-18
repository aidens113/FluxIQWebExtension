# finish-branches/t905-result-datasets

## Outcome

Partial. Both decisions are in and both target tests pass. The typecheck and the structure audit pass. The acceptance
vitest set is not fully green: 2 tests in `service/datasets/tests/service-wiring.test.ts` fail. They run a saved Flow
through `runRuntimeSession`, which reaches none of the modules I changed. The previous worker's run did not include
`service/datasets`, so these two had not been run on t905 before (see Open questions).

## What changed and why (Core worktree `fxwork/t905/!FluxIQ`, `packages/fluxiq/src/framework/automation-service/service/answer-first/`)

- **Decision 1, `attempt/tests/keep.test.ts:51`.** The expectation is now `{ collected: 3, duplicates: 0, kept: 3 }`, with
  a one-line comment citing D1 and `mvp-launch-plan/reports/result-evidence-design.md`. I confirmed it by running the test,
  which passes. Nothing else in the test changed.
- **Decision 2, cause.** A publication goes under `step.<outputStepId>.v<n>`. When the output step or its version
  changed, the new answer went to a new dataset, and the old one stayed in the run as a second result
  (`step.first.v1` beside `step.by-hand.v1`).
  - `rows/row-sink.ts`: once a publication is stored, `retireSuperseded` retires every other publication the sink
    holds through a new optional `retire` writer.
    - The new publication is written first, so there is never a moment with no result.
    - A retirement the store refuses stays listed and is retried on the next `publish`. This includes a `publish`
      whose fingerprint is unchanged. It never throws, so a cleanup failure cannot cost the result at the ending.
      This is the class of failure the previous worker traced.
    - Capture datasets (`read.*`) and a saved Flow's own batches are never publications, so they always stay.
    - The header comment says all of this ("One result in the run").
  - `rows/sink-type.ts`: new `carried(datasetId)`. A carried-on attempt registers the earlier segment's publication
    that `copied-rows.ts` copied into the new run. It is then retired like the sink's own publications if the new run
    publishes under another id. An id outside the `step.` namespace is ignored, so an older attempt's `read.*` result
    is never retired. `rows/sink-input.ts` gains `retire?`.
  - `attempt/run-attempt.ts`: wires `retire` to the existing `AutomationStudioRunDatasets.deleteRunDatasets({ projectId, runId, datasetId })`,
    only where `datasets.available`. `carriedOn` calls `run.sink.carried(shown.datasetId)` after the copy.
    `attempt/contracts.ts` adds `"deleteRunDatasets"` to the `datasets` Pick. `service.ts` already passes the real
    `runDatasets`, so no fake changed.
  - **No new datasets method.** `deleteRunDatasets` already removes exactly one dataset of a run. Nothing under
    `service/datasets/` changed.
- **Decision 2, test, `tests/latest-read.test.ts:116`.** It now asserts that the result is `step.by-hand.v1` and that
  the run's datasets are exactly that plus `read.first`, `read.replayed` and `read.by-hand`, compared as sorted
  lists. The title reads "one result dataset beside each read's capture". A "Changed by lane t905" comment says why.
- **New unit test, `rows/tests/superseded-publication.test.ts` (5 cases):**
  - a superseded publication is retired and a capture is not;
  - a new version of the same step retires the old one, and publishing again under a retired id writes it again;
  - a refused retirement is retried and never fails `publish`;
  - a carried `step.*` copy is retired and a carried `read.*` is ignored;
  - a carried id published again is not retired.

## Commands run and observed results (all through `heavy-slot.mjs run`)

1. Narrow run, from `packages/fluxiq`:
   `vitest run .../attempt/tests/keep.test.ts .../tests/latest-read.test.ts .../answer-first/rows .../tests/carry-on.test.ts --maxWorkers=1 --minWorkers=1`
   - Before the latest-read change: exit 1. "Test Files 1 failed | 8 passed (9)", "Tests 1 failed | 70 passed (71)".
   - keep and superseded-publication passed.
   - latest-read:116 received `["step.by-hand.v1","read.by-hand","read.replayed","read.first"]`, so `step.first.v1` was gone.
     That listing is what the new expectation names.
2. Acceptance run (`t905rd-inner.sh`), one slot:
   - `pnpm.cmd exec vitest run src/framework/automation-service/service/answer-first src/framework/automation-service/service/datasets src/runtime/answer-first src/runtime/flow-authoring/draft src/engine/automation/input-use src/engine/automation/tests --maxWorkers=1 --minWorkers=1`
     exited 1. "Test Files 1 failed | 245 passed (246)", "Tests 2 failed | 2227 passed (2229)", 1677 s.
     - The only failures are `datasets/tests/service-wiring.test.ts` "fails the attempt, and saves no rows, when the
       project's store cannot be opened" and "ends a fully adaptive run failed for its own step, not by throwing,
       when its store goes away".
     - Both throw `AggregateError: Automation Studio project database pool is closing ...` from
       `runtime-session/ending.ts:86` and `:74`, through `service.ts` `runRuntimeSession`.
     - Every answer-first test passed, latest-read and keep included.
   - `pnpm.cmd --filter fluxiq check` exited 0. tsc ran, with no errors.
   - `node scripts/structure-audit.mjs` (Core root) exited 0: "passed (554 warning(s), 909 baselined)", the same counts as before. No rebaseline.
3. `vitest run src/framework/automation-service/service/datasets/tests/service-wiring.test.ts` alone exited 1. "Tests 2 failed | 5 passed (7)", with the same two
   `AggregateError`s. It is deterministic, not interference from other files.

## Not verified

- The retirement of a carried copy has unit coverage only. No carry-on integration test lists the new run's datasets.
- I did not establish whether the two service-wiring failures also fail on `dev`, since running in another worktree is out of bounds.
- No Lab, browser, full suite or paid call was run.

## Open questions or contradictions (lead)

1. **`service-wiring.test.ts` (2 tests): not caused by this change.**
   - `runRuntimeSession` imports nothing from `answer-first/rows` or `answer-first/attempt`. The only reach is the
     dynamic import for answer-first mode, `service.ts:1570`.
   - t905's own commits change `persistence/.../run-dataset-store.ts` (batch `evidence_json`), add a batch-evidence
     migration, and change `service/datasets/run-datasets.ts`, all relative to dev.
   - The tests' contract is t258's: a closed store ends the run failed and is never thrown at the caller.
   - It needs an owner for `runtime-session/` or `persistence/`. Both are outside my paths.
2. **Retirement writes an audit event.** `deleteRunDatasets` writes one `deleted` audit event, with no actor, for each
   retired publication. That is an honest record that the run removed it. If the audit trail should hold only a
   person's deletions, a focused datasets method without the event is the alternative.
3. **A publication stays when nothing replaces it.** One with no columns, or no output step at all (`answer.datasetId`
   undefined), retires nothing. The last publication then stays listed as before. I left this unchanged.
