# `az-facility-evaluation-producers` — typed diagnostic propagation

## Outcome

Implemented the evaluation-producer partition. Every shared evaluator caller
now has to state `facilityFailure` explicitly; the common assembler writes it,
single-run and both bench lanes preserve it, and a no-final-bundle attempt
requires a non-null diagnostic while retaining its inconclusive semantics.

## Changed

- `run-evaluation/observed-run-evaluation.ts`: `ObservedRun` requires
  `RunEvaluation["facilityFailure"]`, and the one common assembler writes it
  before contract validation.
- `run-evaluation/single-run-evaluation.ts`: `SingleRunInput` requires the
  nullable field and forwards it unchanged.
- `bench/evaluate-run.ts`: recording and Flow inputs require and forward the
  nullable field. `evaluateFailedAttempt` requires a non-null diagnostic;
  category classification, inconclusive verdict, null automation observations,
  empty actions/evidence, and provider-free defaults remain unchanged.
- Focused tests cover 0.2 serialization of a finalized readiness diagnostic,
  rejection of a diagnostic on a pass, null on an expected automation result,
  non-null no-final-bundle preservation, empty synthetic automation data, and
  bench/single producer parity.
- Brief correction approved by the supervisor: the ax partition omitted two
  tests that directly call `evaluateObservedRun`. I made only mechanical
  `facilityFailure: null` fixture updates in
  `evidence-budget-invariant.test.ts` and
  `observed-run-evaluation.test.ts`; no other scope was expanded.

## Validation

- A focused TypeScript check over the three changed producer modules,
  `bench/tests/evaluate-run.test.ts`, and the two directly owning evaluator
  tests exited 0.
- `git diff --check` over the owned files exited 0.
- The full test-runner package check was attempted and correctly stopped on
  integration work outside this partition: `run-scenario.ts` and
  `run-bench.ts` had not yet supplied the now-required value, and unrelated
  evaluation literals still used schema 0.1 or omitted the new field. These
  errors were reported to the supervisor and were not bypassed by weakening
  the producer types.
- Runtime tests were not run because the package test command first builds the
  entire runner and therefore cannot reach the focused tests until the A/C and
  global-fixture integration lands. The supervisor must rerun the focused tests
  and full package check/test after those partitions integrate.

No contract, scenario/projector, campaign, Core, extension, or generated file
was changed. No Lab/corpus run, commit, or push was performed.
