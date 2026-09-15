# `bg-shard-child-executor` — nested resumable execution

## Outcome

Refactored the resumable campaign engine around an explicit campaign directory
so a precreated shard child can execute and resume inside its own nested,
independently leased directory. Serial creation and resume retain their public
behavior, while serial APIs and the execution engine reject shard-parent
authority.

## Changed

- `bench/run-bench.ts` now exports
  `executePrecreatedBenchCampaign(PrecreatedBenchCampaignOptions)`. The seam:
  - requires an immutable on-disk shard-child manifest equal to the supplied
    authority;
  - accepts only the canonical
    `<runs>/bench/<parent>/shards/<index>` directory;
  - reloads the parent manifest and checks the child's parent plan, algorithm,
    count, request, compatibility, timestamp, semantics, and deterministic
    partition against the current corpus/manifests;
  - creates generation zero only when absent, then resumes the existing hash
    chain and preserves all prior crash reconciliation behavior;
  - takes an optional precreated-only generic
    `withCellSlot(operation)` callback around each `runScenario` call. Ordinary
    serial campaigns never use it; checkpointing, reconciliation, and
    aggregation do not occupy a machine slot.
- The same file exports
  `publishPrecreatedBenchParentProjections(...)`. It accepts exact
  parent-ordered authenticated `{ completed, evaluation }` pairs, validates
  executable coverage and evaluation identity, and reuses the existing normal
  projection publisher. Parent `runs.json` links to the immutable child
  evaluations under `shards/<index>/evaluations/`; the helper does not write a
  parent checkpoint or merge seal.
- Existing serial create/resume now pass their explicit directory into the
  shared engine. `resumeBench` and `loadResumableBenchRequest` fail closed on
  shard manifests.

## Proofs

- A nested child crashes after its first finalized bundle, releases its cell
  slot, reconciles that bundle on resume, finishes every runnable cell exactly
  once, and remains idempotent on another resume.
- Slot accounting proves release after passing cells, thrown scenario failures,
  and the post-bundle interruption. A live child lease excludes a second
  executor.
- Parent, escaping, wrong-index directory, wrong parent-plan, and changed
  current-plan inputs fail before execution.
- Both children execute independently; their authenticated evaluations produce
  parent-ordered runs/report/Markdown with readable child evaluation links and
  no parent checkpoint or seal. Missing coverage and changed evaluation
  identity fail closed.
- The five original serial crash boundaries and durable diagnostic exact-once
  proofs remain passing.

## Validation

- Final focused strict TypeScript check over `run-bench.ts` and its owning test:
  exit 0.
- Final focused `run-bench.test.ts`: 29/29 passed.
- An earlier whole-package test after the new executor and projection APIs:
  783/783 passed; the final child-relative evaluation-link assertion was then
  rerun in the focused suite.
- `git diff --check` over the owned files: exit 0.
- Structure audit has no violation in the owned files. The repository-wide run
  remains blocked by concurrent direct-import violations in `load-report.ts`
  and `compare-reports.test.ts`.
- The latest package check reached only a concurrent integration error in
  `sharded-bench.ts` (`BenchReport.results` does not exist); the owned files pass
  their isolated strict check. The orchestrator worker was notified.

No campaign store, shard planner, merge, CLI, command, machine-slot, barrel,
Core, extension, or Lab file was edited. No Lab/full corpus run, commit, or push
was performed.
