# `ba-parallel-bench-design` — deterministic cell sharding

## Outcome

The safe design is one logical campaign with one immutable full plan, plus
independent child campaigns whose plans are deterministic disjoint subsets.
Each child keeps the existing single-writer lease, checkpoint chain, immutable
evaluation receipts, deterministic retry IDs, and crash reconciliation. A
separate parent lease owns only orchestration and the final merge. No two
processes ever append to the same checkpoint chain or write the same evaluation
path.

Do not parallelize the current `executeCampaign` loop against one campaign
directory. Its correctness depends on one `checkpoint` variable, a whole-list
`completed` snapshot in every generation, one active attempt, and one lease.
Multiple writers would race on generation names and could each publish a valid
but contradictory successor. The lease correctly prevents that today and
should remain unchanged.

## Proposed CLI

Creation:

```text
lab bench --corpus week1 --repeat 3 --target isolated --evidence failure --shards 3 --jobs 2
```

- `--shards N` is the number of immutable child plans, bounded to 2–8. Omitting
  it retains today's serial campaign byte-for-byte.
- `--jobs N` is concurrent shard executors, from 1 through `shards`. It defaults
  to the smaller of `shards` and the machine-wide Lab-cell cap.
- Both are creation-only. `lab bench --resume <logical-bench-id>` reads them
  from the parent and accepts no plan/scheduling override, as resume does now.
- The lifecycle line prints the logical parent ID promptly. Child IDs may be
  included in a second bounded lifecycle record but are internal; users always
  resume and compare the logical ID.

Reject duplicate flags, `--shards 1`, `--jobs` without `--shards`, jobs above
shards, unsafe integers, and sharding with `persistent-isolated` initially.
Parallel processes against one named persistent workspace are not isolated;
support can be added only after workspace-per-shard ownership exists.

## Identity and deterministic partition

The parent keeps the complete current repeat-major `CampaignPlan`. Partition
by **result group**, not by individual repeated cell:

1. Group the full plan by the existing result identity
   `[corpusRowId, scenarioId, workflowId, variantId, lane]`, deliberately
   excluding `repeatIndex`.
2. Preserve group order by first parent ordinal.
3. Assign group ordinal `i` to shard `i % shardCount`.
4. Preserve parent order within each shard and reindex only the child's local
   `ordinal`. Do not change `cellKey`; it already authenticates the six-field
   identity including lane and repeat.

Keeping every repeat of a result in one child is important. The existing
aggregator requires exactly `repeatCount` evaluations in each result and can
therefore validate a child independently. Per-cell modulo would split repeats,
causing a healthy child to fail its own aggregation at the end.

Add an exact `execution` member to campaign schema `0.3`:

```text
serial
or
sharded {
  algorithm: "result-round-robin-v1",
  shardCount,
  jobs,
  shards: [{ index, campaignId, planSha256 }]
}
```

The parent manifest carries the full plan and sharded execution descriptor.
Each nested child manifest is an ordinary serial campaign with the same request,
compatibility, semantics version, and its subset plan. Parent creation chooses
all child IDs and plan hashes before any cell starts, so resume cannot substitute
a newly convenient shard. The parent parser must prove:

- indices are exactly `0..N-1` and IDs/hashes are unique;
- recomputing the algorithm from the full plan yields every child plan exactly;
- every parent cell occurs in exactly one child, with no overlap or omission;
- request, compatibility, and semantics are identical on parent and children.

The evaluation-schema change and the sharding behavior both require a new
`BENCH_SEMANTICS_VERSION`. Existing paused campaigns remain resumable only from
their exact old clean pin, which is already the compatibility rule; do not
silently upgrade or mix their receipts.

## Directory and ownership model

```text
<runs>/bench/<logical-id>/
  campaign.json                 full plan + sharded descriptor
  checkpoints/                 parent merge checkpoints only
  lease/                       one parent orchestrator/merge owner
  shards/0000/campaign.json    ordinary child authority
  shards/0000/checkpoints/     child-only chain and lease
  shards/0000/evaluations/     child immutable receipts
  ...
  evaluations/                 byte-identical authenticated merge copies
  runs.json, report.json, report.md
```

Run bundles remain at `<runs>/<child-run-id>` as today. Their existing
`bench-receipt.json` names the child campaign. Child run IDs include the child
campaign ID and local ordinal, so they remain globally unique and deterministic
across retry. `executeCampaign` needs an explicit campaign-directory parameter;
it must not infer every child directory with `benchDirectory`.

The parent starts at generation zero with no active attempt. Only the parent
merge writes later parent checkpoints. Each child has its own generation-zero
checkpoint, active-attempt sequence, terminal `finished` checkpoint, and lease.
Thus the current store and lease invariants remain local and simple.

## Authenticated merge

Merge only after all child chains are terminal and unleased. Under the parent
lease:

1. Reload every parent/child manifest and every complete checkpoint chain.
2. Reject ignored generations, a non-`finished` child, an active attempt, live
   or stale unresolved lease, compatibility drift, and any plan mismatch.
3. Rehash every child evaluation and parse its contract. Verify cell identity,
   expected failure, run ID, and bundle receipt using the existing validation
   path. Never trust a child's non-authoritative `runs.json` or report.
4. Build a map by parent `cellKey`; reject duplicate, missing, or orphan cells.
5. Copy the authenticated evaluation bytes create-exclusively into the parent
   `evaluations/` directory. An existing identical copy is resumable; an
   existing different copy fails closed.
6. Iterate the **parent plan**, not shard completion order, to create parent
   completed records and `runs.json`. This restores the current canonical plan
   order and inserts each declared skip once.
7. Write a parent `aggregating` checkpoint containing every completed cell and
   the copied evaluation digest. Then atomically write `runs.json`,
   `report.json`, and `report.md` through their current owners.
8. Write a create-only merge seal containing the parent manifest digest, every
   child manifest and terminal-checkpoint digest, and the three projection
   digests. Only then append the parent `finished` checkpoint.

Readers treat a sharded logical report as complete only when both the finished
parent checkpoint and valid seal exist. If a crash leaves copied evaluations or
some projections but no seal, resume revalidates children, accepts only
byte-identical copies, rewrites replaceable projections, and seals once. The
merge never reruns a completed cell and never derives authority from a partial
projection.

`groupBenchResults` and `aggregateBenchReport` need no sharding branch: they
receive the full parent-ordered evaluations. Existing compare paths should load
only the logical report. Closeout should additionally read the optional merge
seal and require matching sharding algorithm, shard count, and jobs for a
shared-load A/B comparison; a mismatch is an explicit comparability gap, not an
equivalent result.

## Recovery behavior

- Parent crash before all child manifests exist: resume creates only the exact
  missing child whose ID/hash was frozen in the parent; contradictory debris is
  rejected.
- Crash during a child: its own active-attempt reconciliation preserves or
  accepts the staged/final bundle exactly as current `resumeBench` does.
- One child fails normally: its evaluation is completed and the other shards
  continue. The logical campaign aggregates failures after all cells finish.
- One child process crashes: release no other child's lease; surviving shards
  continue. Parent resume later reclaims only the dead child's lease by boot,
  PID, and process identity.
- Crash after every child finishes but before merge: no scenario reruns; merge
  starts from terminal child chains.
- Crash at any copy/projection/seal boundary: replay the idempotent merge and
  fail on any byte contradiction.
- A second resume of the same logical ID is refused by the parent lease. A
  direct child resume should not be exposed by CLI.

## A/B independence and resource cap

A and B remain separate logical campaigns under separate run roots and distinct
Lab instance/build labels. They use the same sharding algorithm/count/jobs but
share no parent, child, checkpoint, evaluation, browser profile, ports, or
bundle. They are compared only after each logical parent is sealed. Never merge
an A child into B, even if its cell identity and compatibility happen to match.

Parallel sharding does not make memory free. One active cell owns a headed
Chromium profile, scenario server, FluxIQ host, extension worker, and supporting
Node processes. Add a machine-wide slot lease, implemented with the same
boot/PID/process-identity fencing as campaign leases, around `runScenario`:

- default hard cap: **two active isolated cells across all Lab processes** on
  this faulty-RAM machine;
- retain at least 4 GiB free physical memory and require 3 GiB per additional
  slot before launch; wait rather than silently reduce the saved job count;
- no build may run while cell slots are active; the existing Lab build lock
  remains outside the CLI and builds once per instance before scheduling;
- permit a higher cap only as an explicit machine configuration after a measured
  stress proof. Never infer it from shard count.

With A and B running together under a global cap of two, sharding improves
recovery and load balancing but cannot honestly double throughput: the machine
still runs only two cells. A single logical campaign can approach twofold speed.
A higher A/B throughput requires first proving three or four concurrent isolated
topologies within the memory and failure-rate budget. The scheduler should use
FIFO slot tickets so one campaign cannot starve the other.

## File-partitioned implementation

| Partition | Files | Responsibility |
| --- | --- | --- |
| CLI | `src/commands.ts`, `src/tests/commands.test.ts` | Parse/bound `--shards` and `--jobs`; preserve strict resume syntax. |
| Pure identity | new `bench/campaign/shard-plan.ts` and owning test | Result grouping, exact round-robin assignment, coverage proof, child-plan hashes. |
| Contract/store | `bench/campaign/identity.ts`, `store.ts`, new `shard-group-store.ts`, their owning tests, campaign barrel | Schema `0.3`, exact sharded descriptor and merge seal, secret-key refusal, nested contained paths. |
| Child executor | `bench/run-bench.ts` and `bench/tests/run-bench.test.ts` | Explicit directory/plan executor seam, child create/resume, parent orchestration and crash hooks. This partition is serial with merge integration because both use `run-bench.ts`. |
| Merge | new `bench/shard-merge.ts` and owning test; `report-store.ts` only if byte-copy/create-exclusive support belongs there | Terminal child validation, exact coverage map, evaluation copies, parent checkpoints/seal, deterministic projections. |
| Slots | new `bench/campaign/machine-slots.ts` and owning test | Cross-process FIFO cap and dead-owner recovery. Reuse lease probe primitives rather than copy their implementation. |
| CLI wiring | `src/cli.ts`, `bench/index.ts` | Dispatch serial versus sharded create/resume and print logical lifecycle. Land after the seams above. |
| Comparison | `bench/closeout-comparison.ts`, `bench/tests/compare-reports.test.ts`, `bench/load-report.ts` if needed | Validate sharded seal and require matching execution topology for shared-load closeout. |
| Documentation | `docs/architecture/testing-facility.md`, repository command docs | Exact CLI, directory authority, cap, recovery, and comparison meaning. |

Keep aggregate math and the public `BenchReport` contract unchanged. Do not add
shard IDs to metric/result identity and do not promote this browser-specific
facility behavior into FluxIQ Core.

## Required tests and mutations

1. **Partition identity:** all repeats of one result land together; lane remains
   identity-bearing; exact fixture mapping is balanced within one group; zero
   overlap and full coverage. Mutate away lane, include repeat, or change modulo
   and require a failure.
2. **Parent/child authenticity:** reject a changed child ID/hash, reordered or
   missing child plan, duplicate cell, wrong algorithm/count, compatibility or
   semantics drift, unknown/secret-bearing keys, and path escape. Mutate the
   coverage check and terminal-digest check.
3. **Independent writers:** two child executors advance different directories;
   two writers to one child are fenced; two parent resumptions yield one owner.
   Mutate each lease acquisition and observe duplicate-generation/refusal tests.
4. **Crash matrix:** crash after parent publish, during child creation, at every
   existing child crash hook, after the last child, after evaluation copy, after
   aggregating checkpoint, after each projection, and before/after seal. Resume
   must execute each scenario cell exactly once except the one legitimately
   interrupted attempt, preserve retry numbering, and produce one terminal seal.
5. **Merge corruption:** flip an evaluation byte, terminal checkpoint digest,
   bundle receipt, expected failure, run identity, or copied parent file. Every
   case fails before a finished parent checkpoint. Mutate hash comparison.
6. **Order independence:** finish children in every permutation and assert the
   same parent run ordering, grouped results, metrics, and verdicts. Preserve a
   frozen merge timestamp across crash/retry so sealed projection bytes are
   idempotent. Mutate parent-plan iteration to shard completion order.
7. **Aggregation:** 189 evaluated plus 12 skips remains exactly 201 plan slots;
   every result has three repeats and current Week 1 metrics equal the serial
   fixture. Mutate skip de-duplication and repeat grouping.
8. **Machine cap:** with two independent A/B schedulers, never exceed two active
   `runScenario` calls; FIFO makes progress on both; low memory prevents launch;
   dead, rebooted, and PID-reused slot owners recover. Mutate the global rather
   than per-process counter.
9. **CLI/resume:** invalid combinations fail; resume ignores no saved setting;
   a logical ID resumes only its frozen children; a serial legacy command stays
   unchanged. Mutate resume dispatch to the serial executor.
10. **Compare:** equal sealed topologies compare normally; differing shard/job
    shapes fail shared-load closeout; sequential comparison discloses rather
    than hides the difference; an unsealed logical report is unreadable.

After unit and mutation proofs, run a small two-shard smoke campaign, forcibly
interrupt one child, resume the logical ID, and compare its aggregate against a
serial smoke report. Only then attempt Week 1. A full-corpus A/B run remains a
separate acceptance proof, not part of implementing the scheduler.

## Inspection boundary

I inspected only the campaign identity/store/lease/executor, command/CLI,
aggregate/report/compare owners, their owning test inventories, and repository
command metadata. I did not inspect run artifacts, secrets, page data, or
unrelated product code. I changed only this report and did not run Lab, edit
production code, commit, or push.
