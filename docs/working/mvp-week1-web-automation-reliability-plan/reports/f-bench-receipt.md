# Stage 4u: deterministic scenario run id and campaign receipt

## Status

Implemented in the assigned downstream files. The focused receipt and runner-
wiring tests pass 16/16 after the mutation was restored, the test-runner package
build passes, and the assigned diff passes `git diff --check`.

## Contract implemented

- `RunScenarioOptions.runId?: string` accepts a supervisor-provided direct-child
  identifier of 1-160 safe filename characters. With no value, the established
  time-plus-random id remains unchanged.
- `RunScenarioOptions.benchReceipt?: BenchReceiptMetadata` accepts only campaign
  id, plan SHA-256, cell SHA-256, exact cell identity, and positive attempt.
  Receipt use requires an explicitly supplied run id.
- `SingleRunInput.repeatIndex?: number` defaults to zero for standalone runs;
  `runScenario` supplies the receipt cell's exact repeat index for campaigns.
- `BenchReceiptCellIdentity` binds corpus row, scenario, nullable workflow and
  variant, `recording|flow` lane, and non-negative repeat index.
- `createBenchReceipt`, `assertBenchReceipt`, and `parseBenchReceiptJson` enforce
  exact keys, bounded safe identifiers/numbers, lowercase 64-hex hashes, an 8
  KiB parse ceiling, and recursive refusal of secret/page/environment-bearing
  key names. Diagnostics never echo rejected values.
- `runScenario` validates both inputs before reading the scenario or creating a
  bundle. It writes `bench-receipt.json` after `evaluation.json` and before
  `bundle.finalize`, so finalization hashes the receipt into the artifact index.

The receipt deliberately carries no verdict, observation, duration, URL,
environment, log, credential, token, or evidence payload. Evaluation remains
the separately hashed source for outcome reconstruction.

## Validation

Command:

```text
pnpm --filter @fluxiq-web-extension/test-runner build
node --test packages/test-runner/dist/bench/tests/bench-receipt.test.js packages/test-runner/dist/run-evaluation/tests/runner-wiring.test.js
```

Observed after restoration: package build exit 0; focused tests 16 passed, 0
failed. An earlier build observed concurrent integration errors in `cli.ts` and
`campaign-store.ts`; their owners resolved them before this final rerun.

An isolated strict TypeScript check over the four assigned source/test files,
run from `packages/test-runner`, passed with no diagnostics:

```text
pnpm exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess --types node src/bench/bench-receipt.ts src/bench/tests/bench-receipt.test.ts src/run-scenario.ts src/run-evaluation/tests/runner-wiring.test.ts
```

Mutation: removed the exact-key comparison in `recordWithExactKeys`, rebuilt,
and reran `bench-receipt.test.js`. The strict-parser test failed (3 passed, 1
failed), proving missing/extra receipt fields are pinned. The comparison was
restored and the focused 16/16 result above was observed.

Follow-up repeat-identity integration:

```text
pnpm --filter @fluxiq-web-extension/test-runner build
node --test dist/run-evaluation/tests/single-run-evaluation.test.js dist/run-evaluation/tests/runner-wiring.test.js
```

Observed after restoration: package build exit 0; focused evaluator/wiring tests
22 passed, 0 failed; strict isolated TypeScript check over the four follow-up
source/test files passed. Mutation hard-coding `repeatIndex: 0` made the exact
campaign repeat test fail with `0 !== 2` (9 passed, 1 failed); restored source
then passed the 22/22 rerun.

## Integration needs and risks

- Campaign orchestration must pass one deterministic `runId` and matching
  `BenchReceiptMetadata` from its durable active-attempt checkpoint.
- The bench barrel may export `bench-receipt.ts` during supervisor integration;
  this partition intentionally did not edit that shared barrel.
- Reconciliation must compare every parsed receipt field with the immutable
  manifest and active attempt. The parser proves shape and bounds, not campaign
  membership by itself.
- Deterministic ids make existing finalized/staging collisions visible through
  `EvidenceBundle`; orchestration still owns interrupted-staging preservation
  before retrying the next attempt.

## Files changed

- `packages/test-runner/src/bench/bench-receipt.ts`
- `packages/test-runner/src/bench/tests/bench-receipt.test.ts`
- `packages/test-runner/src/run-scenario.ts`
- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`
- `packages/test-runner/src/run-evaluation/single-run-evaluation.ts`
- `packages/test-runner/src/run-evaluation/tests/single-run-evaluation.test.ts`
- `docs/working/mvp-week1-web-automation-reliability-plan/reports/f-bench-receipt.md`

No Core file, shared working document, run artifact, commit, push, or live Lab
state was changed.
