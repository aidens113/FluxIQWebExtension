# `ay-facility-projection-stages` — closed projection and scenario stages

## Outcome

Partition A is implemented. `runScenario` now distinguishes finalized-bundle
facility failures from errors escaping before bundle finalization, carries one
closed diagnostic into the evaluation producer, and preserves a primary
execution diagnostic when cleanup also fails.

## Changes

- Added `facility-failure/` with a closed `projectFacilityFailure` projector,
  an idempotent `ProjectedFacilityError`, and a barrel export.
- Reused the existing topology-readiness, HTTP-transport,
  pairing-status-wait, and finalized-recording-wait projections. Only contract
  boundary/stage/reason and admitted operation stage, cause code, or timeout
  fields can enter the result; unknown and hostile inputs fail closed to
  `unclassified`.
- Exported `boundedRunnerCause` from `failure.ts`. Classification and durable
  projection now share one bounded, getter-safe cause-chain selector backed by
  the contract cause-code list plus the existing process-only `EADDRINUSE`.
- Kept `runScenario` as a small public wrapper and moved its prior body into a
  private implementation with a stage setter. The setter advances before
  `scenario.load`, `bundle.initialize`, `scenario.execute`,
  `scenario.cleanup`, and `bundle.publish` work.
- Added a nullable `facilityFailure` beside the existing primary failure state.
  Main execution projects it at `scenario.execute`; cleanup replaces it only
  when cleanup becomes primary. The value is passed explicitly to
  `singleRunEvaluation`. Existing/clone no-observation lanes still do not
  invent an evaluation.
- Updated focused classifier, projector, and source-wiring tests. The tests pin
  every contract boundary/stage, exact known projections, sentinel exclusion,
  hostile getter/proxy handling, bounded causes, idempotence, stage order,
  evaluation wiring, and primary-over-cleanup precedence.

## Validation

- `pnpm --filter @fluxiq-web-extension/test-runner check` — passed.
- Focused emitted tests:
  `node --test packages/test-runner/dist/facility-failure/tests/project-facility-failure.test.js packages/test-runner/dist/tests/failure.test.js packages/test-runner/dist/run-evaluation/tests/runner-wiring.test.js`
  — passed, 27/27.
- `git diff --check` — passed; line-ending conversion warnings only.

An earlier check found the parallel contract migration had not yet added the
required nullable field to `flow-lane/tests/lane-observation.test.ts`. The
supervisor applied that mechanical global fixture update; the rerun above then
passed. I did not edit that out-of-partition file.

## Boundary

No Lab or corpus run was performed. No contract, evaluation-producer, bench,
Core, extension, or generated artifact was intentionally edited by this
partition. No commit or push was made.
