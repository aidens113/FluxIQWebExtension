# `aw-facility-failure-contract` — immutable typed facility diagnostic

## Outcome

`RunEvaluation` now writes schema `0.2` and requires `facilityFailure`, which is
either `null` or an exact, bounded `FacilityFailureDiagnostic`. Candidate
comparisons remain schema `0.1` through their own version constant. The JSON
reader and validator explicitly normalize a legacy schema-`0.1` evaluation
without this field to schema `0.2` with `facilityFailure: null`; a purported
legacy value that already carries the new field is rejected rather than treated
as either schema.

The diagnostic contains only:

- `boundary`: `finalized-bundle` or `no-final-bundle`;
- `stage`: `scenario.load`, `bundle.initialize`, `scenario.execute`,
  `scenario.cleanup`, `bundle.publish`, or `bench.persist`;
- one closed reason: `readiness.timeout`, `http.timeout`, `http.abort`,
  `http.transport`, `module.missing`, `path.missing`, `path.denied`, or
  `unclassified`;
- optional closed `operationStage` and `causeCode`, plus an integer `timeoutMs`
  from 1 through 300,000, only in the combinations the reason permits.

The validator rejects unknown enum members, extra/raw-shaped keys, arbitrary
cause codes, invalid reason/detail combinations, missing required fields, and
out-of-range or fractional timeouts. A diagnostic cannot accompany a passing
evaluation, omit the test-rig `failureCategory`, or coexist with a reported
automation result. A schema-`0.2` inconclusive synthetic result must carry a
diagnostic. Ordinary passing/product evaluations retain
`facilityFailure: null`.

## Exported seam

The existing `EVALUATION_SCHEMA_VERSION` is now `"0.2"`. New exports are:

- `CANDIDATE_COMPARISON_SCHEMA_VERSION` (`"0.1"`);
- `facilityFailureBoundaries` / `FacilityFailureBoundary`;
- `facilityFailureStages` / `FacilityFailureStage`;
- `facilityFailureReasons` / `FacilityFailureReason`;
- `facilityFailureOperationStages` / `FacilityFailureOperationStage`;
- `facilityFailureCauseCodes` / `FacilityFailureCauseCode`;
- `FacilityFailureDiagnostic`.

No barrel edit was required because `src/index.ts` already exports all of
`evaluation.ts` and `evaluation-validation.ts`. Runner producers should use
these names directly rather than restating the enums. They must also change
campaign semantics/compatibility before any schema-`0.2` campaign is resumable;
this worker did not own that runner change.

## Validation

- `pnpm --filter @fluxiq-web-extension/test-contracts check`: passed.
- `pnpm --filter @fluxiq-web-extension/test-contracts test`: passed, 73/73.
- `git diff --check` on the three owned files: passed (Git emitted only the
  repository's LF-to-CRLF working-copy warning).

The first full test run exposed the untouched runtime-contract fixture still
using schema `0.1` through `assertRunEvaluation` (72/73). Making normalization
part of the validator/read seam, rather than only the JSON parser, restored the
explicit compatibility contract; the complete suite then passed twice.

## Files and boundary

Changed:

- `packages/test-contracts/src/evaluation.ts`
- `packages/test-contracts/src/evaluation-validation.ts`
- `packages/test-contracts/tests/evaluation-contracts.test.mjs`

I did not edit runner code, the barrel, FluxIQ Core, or any other production or
test file. I did not run Lab, commit, or push.
