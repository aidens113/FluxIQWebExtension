# `bk-sharded-bench-docs` — sharded bench architecture

## Outcome

Updated the authored testing-facility and repository-layout architecture to
describe the durable serial and sharded bench as implemented, including its
operator commands, authority boundaries, global admission controls, recovery,
merge authentication, comparison constraints, and ignored artifact layout.

## Changed

- `docs/architecture/testing-facility.md` now documents:
  - serial-by-default execution and the `--shards`/`--jobs` bounds;
  - result-group round-robin partitioning that keeps all repeats together;
  - shard-parent coordination versus independently leased child execution;
  - the FIFO, two-cell global slot cap and 4 GiB reserve/3 GiB-per-cell memory
    gate, rechecked around each `runScenario` cell;
  - checkpoint recovery, finalized-bundle reconciliation, and exact explicit
    resume;
  - authenticated merge projections/seal and finish ordering;
  - serial and sharded artifact trees;
  - enforced shared-load A/B topology equality, with explicit mismatch
    disclosure for `--sequential` comparison;
  - smoke, full Week 1, and resume command forms;
  - original compatible pin-only campaign resume and normalized read/compare
    support for older completed evaluations/reports.
- `docs/architecture/repository-layout.md` now gives the concise bench command
  and runtime-layout reference beside the generated-data policy, and identifies
  durable campaigns as ignored runtime state.
- Existing machine-specific checkout examples in the two owned pages were
  replaced with sibling/override wording; no new local roots were recorded.

## Validation

- `git diff --check` over both owned architecture files: exit 0.
- Machine-specific drive/root scan over both owned files: no matches.

No code, generated documentation, Core, extension, or Lab artifact was changed.
No test/Lab/full-corpus run, commit, or push was performed.
