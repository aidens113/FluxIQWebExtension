# `bi-sharded-bench-orchestrator` — logical create/resume scheduler

## Outcome

Implemented new-file-only `createShardedBench` and `resumeShardedBench` seams.
Creation freezes the full parent/child authority before work begins, including
the exact `shardCount` and `jobs`. Resume loads those saved values and rejects
runtime scheduler/manifest overrides.

The parent lease remains held through child scheduling, authenticated merge,
projection publication, seal creation, and the finished checkpoint. A bounded
worker pool runs at most the saved job count. Each child receives a per-cell
wrapper that acquires, verifies, and finally releases the filesystem-backed
global machine slot. Recorded cell failures remain terminal measurements and
do not stop siblings. A thrown child/scheduler failure is collected while
other siblings continue, then returned as an aggregate failure for resume.

Terminal unleased children are skipped on resume. A terminal child with a
residual lease is routed through its executor so stale ownership can be fenced
and reclaimed rather than bypassed.

## Merge/recovery order

After all children become terminal, the orchestrator performs:

1. authenticated validation and idempotent parent evaluation copies;
2. a parent `aggregating` checkpoint with exact parent-ordered completion
   receipts;
3. normal parent `runs.json`, `report.json`, and `report.md` publication through
   the existing projection helper;
4. an exact authenticated merge seal;
5. the parent `finished` checkpoint.

Crash hooks cover parent creation and every scheduling/merge boundary. Resume
accepts authenticated copied evaluations, exact existing aggregating state,
replaceable unsealed projections, or an existing valid seal. Once sealed, it
verifies projection and child digests and never rewrites projections. A second
finished resume returns an equivalent `RunBenchOutcome` from sealed artifacts,
including workflow-result count and the report's authoritative execution
coverage, without re-entering children.

The focused tests found and fixed one real ownership defect during development:
returning the merge promise directly from the lease `try/finally` released the
parent lease early. The final implementation explicitly awaits the merge/fast
path before release.

## Validation

- Focused strict TypeScript compilation: passed.
- Focused orchestrator tests: 12/12 passed, including seven crash-boundary
  subtests.
- `pnpm --filter @fluxiq-web-extension/test-runner check`: passed.
- `pnpm --filter @fluxiq-web-extension/test-runner test`: passed, 799/799.
- `pnpm structure:check`: passed with advisory warnings only; the new
  orchestrator and test consume campaign ownership through its barrel.
- `git diff --check` over both owned files: passed.

Coverage includes lifecycle order, saved job cap, per-cell slot acquire/assert/
release, recorded failure continuation, child crash continuation and resume,
every parent merge boundary, exact second resume without projection mutation,
override refusal, target/count validation, and serial-parent rejection.

## Files

- `packages/test-runner/src/bench/sharded-bench.ts`
- `packages/test-runner/src/bench/tests/sharded-bench.test.ts`
- this report

No existing source/barrel/CLI/command/store/merge/executor/comparison file, Lab
run, commit, or push was performed.
