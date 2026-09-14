# f-bench-resume-orchestration

Outcome: Complete; ready for supervisor integration and live interruption proof

## Implemented

- Added `createResumableBench`, `resumeBench`, and
  `loadResumableBenchRequest`, while retaining legacy `runBench` unchanged for
  callers that have not moved to campaign orchestration.
- Creation durably publishes `campaign.json` and generation zero before the
  first cell. Each cell receives a deterministic direct-child run id, exact
  six-field receipt identity, and an active-attempt checkpoint before launch.
- Resume requires the saved request, canonical expanded plan, plan hash, and
  complete compatibility fingerprint to match exactly before it runs a cell.
- Reconciliation validates immutable evaluation hashes and exact identities,
  finalized bundle integrity, receipt bindings, deterministic attempt ids, and
  the bundle's hashed evaluation identity including `repeatIndex` and expected
  failure. Duplicate/orphan campaign receipts and contradictory final/staging
  state fail closed.
- A valid finalized active attempt is reconstructed through the historical
  bench evaluators and checkpointed without rerun. Staging is preserved under
  `interrupted/` and retried with the next attempt. Caught runner exceptions
  retain the established inconclusive evaluation semantics.
- `runs.json`, `report.json`, and `report.md` are regenerated only from exact
  immutable-plan coverage. Resuming a finished campaign repairs projections
  idempotently; aggregate content is equivalent apart from timestamps.
- `readRunBundle` now optionally parses hashed `evaluation.json` and
  `bench-receipt.json`; their absence remains valid for legacy/non-campaign
  bundles, while campaign reconciliation requires both.

## Public integration API

- `createResumableBench(options & { compatibility, lifecycle?, crashHook? })`
- `resumeBench(options & { benchId, compatibility, lifecycle?, crashHook? })`
- `loadResumableBenchRequest(runsDirectory, benchId)`
- Crash points: `after-campaign-published`, `after-attempt-checkpoint`,
  `after-bundle-finalized`, `after-completion-checkpoint`, and
  `before-aggregation`.

The CLI owner must construct the strict compatibility fingerprint, load the
saved request for `--resume`, resolve its corpus/target, and call these APIs.
The bench barrel must export them during supervisor integration.

## Validation

- Restored focused `run-bench.test`: **17/17 pass**.
- Full test-runner suite before the final exact-repeat test: **680/680 pass**.
- Test-runner package build: pass.
- Test-runner package check: pass.
- Assigned-file `git diff --check`: pass (line-ending notices only).

Crash tests throw at all five real orchestration boundaries. They prove the
same campaign id, six exact evaluations plus four skips in the unit plan, no
duplicate scenario calls, staging preservation, finalized-bundle
reconciliation, post-completion recovery, and idempotent aggregate repair.
Guard tests reject compatibility drift, corrupted evaluation bytes, and a
finalized bundle whose hashed evaluation names the wrong repeat.

Mutations, each observed failing and restored:

1. Disabled finalized-active reconciliation: the crash test observed seven
   calls instead of six.
2. Skipped the first executable cell: the aggregate coverage guard refused the
   partial campaign.
3. Removed the finalized bundle `repeatIndex` comparison: the corrupt-repeat
   test reported `Missing expected rejection`.

Stage 4u separately proved repeat-bearing cell keys, compatibility comparison,
and checkpoint hash-chain/truncated-temp behavior. This partition consumes
those validated APIs rather than duplicating their mutations.

## Integration needs and risks

- The concurrently landed `singleRunEvaluation` repeat propagation is required;
  without it, repeat-one and repeat-two bundle evaluations cannot satisfy the
  exact identity check.
- CLI lifecycle output, signal handling, compatibility construction, barrel
  exports, and the live smoke interruption are outside this owned partition.
- The active process has no cross-process campaign lock. A second simultaneous
  resume can collide on immutable checkpoint generations and fail, but explicit
  single-owner enforcement remains an integration requirement.
- `interrupted/` evidence is preserved and never counted. Retention/cleanup is
  intentionally not automatic.

## Files changed

- `packages/test-runner/src/bench/run-bench.ts`
- `packages/test-runner/src/bench/read-run-bundle.ts`
- `packages/test-runner/src/bench/tests/run-bench.test.ts`
- this report

No CLI, barrel, report-store, shared working document, Core file, commit,
remote, or live run root was changed by this partition.
