# i-bench-resume-contract

Outcome: Complete (read-only design)

## Finding

The smallest sound recovery unit is a **campaign cell**, not a process and not
merely a run bundle. Today `runBench` mints a new bench id on every invocation,
expands the corpus in memory, and appends a completed record to `runs.json`
only after `runScenario`, bundle inspection, bundle reading, evaluation writing,
and return to the loop (`run-bench.ts:95-117,141-188`). `runs.json` is rewritten
directly (`report-store.ts:72,90-94`). A finalized bundle can therefore exist
without any durable statement of which corpus cell it satisfied. The random run
id is minted inside `runScenario` (`run-scenario.ts:49-50`), after the bench has
chosen the cell, so the pre-run state cannot name the bundle it should reconcile.

The existing artifacts are useful but insufficient as the authority:

- `runs.json` already carries the bench/result identities and is consumed by
  comparison loading, but its parser validates only that `runs` is an array and
  then trusts evaluated records (`load-report.ts:24-35`).
- A finalized bundle contains a hashed `evaluation.json` before finalization
  (`run-scenario.ts:495-511`), but the bench deliberately derives recording-lane
  observations with its legacy bench semantics, while the single-run evaluation
  uses the lane's direct observation (`evaluate-run.ts:78-143`). It cannot be
  substituted blindly.
- The current result key omits `repeatIndex` (`run-bench.ts:195`); it is a report
  grouping/sort key, not a completed-cell identity.

Recovery therefore needs (1) an immutable campaign manifest, (2) durable,
generation-numbered checkpoints, and (3) a bundle receipt tying a predeclared
attempt/run id to one exact campaign cell. `runs.json`, `report.json`, and
`report.md` remain projections and can always be regenerated.

## Minimal public contract

Create a campaign with the existing command:

```text
pnpm lab bench --corpus week1 --repeat 3 --target isolated --evidence failure
```

Resume it explicitly with:

```text
pnpm lab bench --resume bench-<base36-time>-<8-hex>
```

`--resume` takes exactly one valid bench id and is mutually exclusive with
`--corpus`, `--repeat`, `--target`, `--workspace`, and `--evidence`. The saved
normalized request is authoritative; a caller cannot accidentally redefine a
campaign. Creation emits a non-secret lifecycle line containing `benchId` and
directory immediately after the campaign manifest is durable, before the first
cell starts. There is no implicit `latest` selection because concurrent benches
are supported.

Old `runs.json`-only benches are inspectable but not resumable. Resume fails
closed with a migration-not-supported diagnostic; inferring a plan from a
partial legacy file would not prove the original exact matrix.

## Campaign identity and compatibility

`<runs>/bench/<benchId>/campaign.json` is written once via temp-file, file sync,
rename, and directory sync. It has schema version `0.2` and contains:

- `benchId`, `createdAt`, and a `benchSemanticsVersion` bumped whenever corpus
  expansion, evaluation, or aggregation semantics change;
- normalized request: `corpusId`, `repeatCount`, resolved target mode and
  persistent workspace (or `null`), and evidence override including explicit
  `null` for manifest-driven evidence;
- the complete ordered expanded plan, including every cell identity, resolution
  result, expected failure, and skip reason;
- `planSha256`, over canonical JSON of that ordered plan;
- facility and Core clean Git commit ids; facility and Core lockfile hashes;
- hashes of the executing test-runner build, extension build, and built Scenario
  Lab registry/manifests used for expansion;
- stable execution environment: OS/platform/architecture, browser identity and
  version, locale, timezone, and viewport. Boot id, uptime, load, paths, ports,
  credentials, and authorization material are observations, not compatibility
  keys and must never enter the manifest.

Both repositories must be clean when a resumable campaign is created. On every
resume, recompute all compatibility fields and the plan from current inputs,
then require exact equality before running anything. A missing artifact is
`environment.missing`; a source/build/environment mismatch is
`process.startup`; malformed, contradictory, or hash-invalid campaign state is
`fixture.invalid`. No mismatch is waived automatically.

The environment list is intentionally strict: mixing browser or build versions
inside a repeatability report would be a different experiment. A reboot alone
is allowed when those stable fields remain equal.

## Cell and attempt identity

The completed-cell key is canonical JSON, then SHA-256, of:

```text
[corpusRowId, scenarioId, workflowId|null, variantId|null, lane, repeatIndex]
```

The human-readable fields remain beside the digest. This adds `repeatIndex` to
the existing result identity and makes all 189 Week 1 executable samples unique.
Plan order assigns each cell an immutable ordinal.

Before starting a cell, persist an `activeAttempt` checkpoint containing its
cell key, ordinal, attempt number, deterministic safe run id, and start time.
Pass that run id and a non-secret campaign-cell receipt to `runScenario`.
Before bundle finalization, `runScenario` writes a hashed
`bench-receipt.json` containing campaign id, cell key, exact identity, runner
verdict/category, lane observation, and measured wall-clock duration. It is the
durable input needed to reproduce the bench evaluation; it contains no page
data, credentials, tokens, or environment values.

One completed checkpoint record contains cell key, run id, relative evaluation
path and evaluation SHA-256. A complete cell must have a valid finalized bundle,
valid receipt matching the manifest and active attempt, a validated evaluation
whose identity matches the cell, and a completed checkpoint record. Skips come
only from the immutable plan and never acquire run bundles.

## Durable checkpoint and projection rules

Do not make replacement of one mutable JSON file the correctness boundary.
Write full checkpoints as immutable
`checkpoints/<zero-padded-generation>.json`: write a unique `.tmp`, sync it,
rename to `.json`, then sync the directory. Each checkpoint contains its
generation, previous checkpoint hash, campaign/plan hash, completed records,
optional active attempt, state (`running|aggregating|finished`), and its own
canonical-content hash. Loading scans generations and accepts the longest
contiguous, hash-linked, fully valid chain. A truncated `.tmp` or unlinked JSON
is ignored and disclosed; contradictory valid successors fail closed.

After every accepted checkpoint, regenerate `runs.json` atomically as the
backward-compatible projection. Its failure never rolls back the authoritative
checkpoint. `loadBenchResults` and comparison retain their public behavior, but
receive a strict `BenchRunsFile` parser and reject duplicate/missing/out-of-plan
cells. Evaluations, final reports, and markdown are written temp/sync/rename as
well. Aggregation reads only the immutable plan plus checkpoint-selected
evaluations, never a directory glob.

Reconciliation on creation/resume:

1. Validate campaign identity, compatibility, checkpoint chain, all completed
   evaluation hashes/identities, and their finalized bundles via `inspectRun`.
2. For the active attempt, look only at its deterministic run id. If its valid
   finalized bundle and matching receipt exist, regenerate/validate the bench
   evaluation and commit completion without rerunning it.
3. If only its staging directory exists, preserve it under the campaign's
   `interrupted/` directory, checkpoint abandonment, and retry with the next
   attempt number. Staging evidence is never counted.
4. If neither exists, checkpoint abandonment and retry. A finalized bundle with
   a missing/mismatched receipt, duplicate campaign receipts for one cell, or a
   completed record whose bundle cannot be verified is corruption and stops the
   campaign; it is not silently rerun.
5. Select the first incomplete executable cell in immutable plan order. After
   all are complete, rebuild projections and aggregate idempotently.

## Crash-point outcomes

| Crash point | Recovery |
| --- | --- |
| Before any run | A durable `campaign.json` reconstructs the empty matrix. If creation died before publishing it, no campaign exists and `--resume` refuses the orphan directory. |
| During staging | The active-attempt checkpoint identifies the staging owner. Preserve it as interrupted evidence, never evaluate it, and retry that cell. |
| After bundle finalization, before checkpoint | Validate the deterministic bundle and receipt, reconstruct its evaluation, and checkpoint the cell complete without rerunning. |
| During checkpoint replacement | Correctness uses immutable generations, not replacement. Ignore an incomplete `.tmp`; validate the latest hash-linked generation. A derived `runs.json` interrupted during replacement is regenerated. |
| After final cell, before aggregation | Reconcile the final active bundle, observe that every executable cell is complete, and regenerate `runs.json`, `report.json`, and `report.md` from the exact original plan. |

## Exit semantics

- A complete campaign returns the existing outcome shape and exit `0` only when
  every evaluated cell passed; it returns exit `1` when the complete campaign
  contains a failed/inconclusive evaluation. Resuming an already finished valid
  campaign is idempotent and returns the same outcome after repairing projections.
- Compatibility, integrity, or CLI failures return exit `1` with the categorized
  JSON diagnostic and do not run a cell or modify accepted completion state.
- A caught termination signal stops scheduling, lets the active run perform its
  existing bounded cleanup, persists the last safe checkpoint, prints an
  `interrupted/resumable` lifecycle record, and exits with the conventional
  signal code (130 for SIGINT, 143 for SIGTERM). An abrupt power loss/restart has
  no exit record; the next explicit resume performs the same reconciliation.
- A runner exception that returns control remains an evaluated inconclusive cell,
  preserving current semantics. Only an attempt with no finalized receipt is
  interrupted and retried; interruption must never fabricate a failed sample.
- No final report or `finishedAt` is published until the checkpoint proves one
  and only one validated evaluation for every executable plan cell and every
  planned skip is present. Thus a resumed report still covers the original exact
  matrix; it is not a splice of convenient survivors.

## Exact implementation and test partition

Files are partitioned so implementation workers need not overlap.

### Partition A: CLI only

- `packages/test-runner/src/commands.ts`: add the mutually exclusive resume
  command shape and usage/validation.
- `packages/test-runner/src/tests/commands.test.ts`: parse valid resume; reject
  missing/invalid id, duplicate flag, and every plan-shaping option beside it.
- `packages/test-runner/src/cli.ts`: dispatch create versus resume and preserve
  categorized exit behavior.

### Partition B: campaign identity/store only

- New `packages/test-runner/src/bench/campaign-identity.ts`: canonical plan/cell
  keys, normalized request, compatibility fingerprint and equality checks.
- New `packages/test-runner/src/bench/campaign-store.ts`: schemas and strict
  parser, immutable manifest/checkpoint writes, hash-chain loading, atomic JSON
  projections, interrupted-staging preservation.
- New `packages/test-runner/src/bench/tests/campaign-identity.test.ts`: key
  uniqueness including lane/repeat, canonical plan hash, compatibility mismatch.
- New `packages/test-runner/src/bench/tests/campaign-store.test.ts`: truncated
  temp, missing generation, bad hash/link, contradictory successor, atomic
  projection interruption, path traversal, and secret-field rejection.
- `packages/test-runner/src/bench/index.ts`: exports only, after integration.

### Partition C: bundle receipt only

- `packages/test-runner/src/run-scenario.ts`: accept a supervisor-provided safe
  run id and campaign-cell metadata; write `bench-receipt.json` before finalize.
- New `packages/test-runner/src/bench/bench-receipt.ts`: receipt type, strict
  parser, and reconstruction input (keeps bench-specific validation out of the
  general evidence bundle).
- New `packages/test-runner/src/bench/tests/bench-receipt.test.ts`: round trip,
  cell/run/campaign mismatch, malformed observation, and no secret-bearing keys.
- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`: pin that
  receipt/evaluation writes precede `bundle.finalize` and supplied run id is used.

### Partition D: orchestration/reconciliation only (after A-C)

- `packages/test-runner/src/bench/run-bench.ts`: create/resume orchestration,
  pre-attempt and completed checkpoints, receipt reconciliation, exactly-once
  cell selection, idempotent aggregation, and lifecycle notification.
- `packages/test-runner/src/bench/report-store.ts`: evolve `BenchRunsFile` to
  the projection schema and route writes through the atomic store helper.
- `packages/test-runner/src/bench/load-report.ts`: strict validated projection
  loading; no change to complete-report lookup behavior.
- `packages/test-runner/src/bench/read-run-bundle.ts`: read the hashed receipt
  alongside current manifest/summary/events data.
- `packages/test-runner/src/bench/tests/run-bench.test.ts`: inject crash hooks at
  all five required boundaries; assert no duplicate calls, same bench id, exact
  plan coverage, evaluation regeneration, and byte-equivalent aggregate content
  apart from timestamps.
- `packages/test-runner/src/bench/tests/compare-reports.test.ts`: reject duplicate,
  missing, hash-invalid, and out-of-plan projection cells; accept a complete
  resumed projection.

Keep public `BenchReport` contracts unchanged: campaign durability is private
Testing Lab infrastructure. No Core file or `test-contracts` public contract is
needed. Auth/session material is deliberately outside all new persisted types.

## Required proof

Unit tests must simulate process death by throwing at explicit persistence hooks,
not by merely calling the resume helper on a hand-built happy path. Mutation
proofs: remove `repeatIndex` from the key; skip compatibility comparison; trust a
truncated newest checkpoint; count staging as complete; rerun a valid finalized
active attempt; aggregate with one missing cell. Each mutation must fail a
focused test.

Then run the full test-runner suite, package check, root `pnpm check/test/build`,
and a small live smoke campaign interrupted once during staging and once after
finalization. Final acceptance is a resumed repeat-three Week 1 A/B bench whose
reports contain the original 189 executable evaluations plus 12 planned skips,
with no duplicate cell key and with the interruption/recovery ledger disclosed.

## Risks and unknowns

- Stable browser/version preflight may need a small probe before the first new
  post-resume cell. If the current launcher cannot report it without starting a
  scenario, validate the first completed receipt before accepting it and fail
  closed; do not weaken the compatibility field.
- Windows directory `fsync` support varies. Immutable checkpoint generations
  still remove replacement ambiguity, but the implementation must test and
  document the actual Node/NTFS behavior and conservatively ignore incomplete
  files after restart.
- Deterministic run ids must not collide with existing persistent-isolated
  allocation state. Attempt number plus campaign/cell identity, strict direct
  child validation, and interrupted-staging preservation are required.
- The bundle receipt must persist only bounded structural observation. A schema
  that permits arbitrary details/page material would violate the repository's
  evidence boundary.
- This design survives process/host interruption; it does not keep processes
  alive through a reboot or automatically relaunch them. A service scheduler is
  a separate operational feature, not required for data-safe explicit resume.

## Files inspected

- `packages/test-runner/src/commands.ts`
- `packages/test-runner/src/cli.ts`
- `packages/test-runner/src/tests/commands.test.ts`
- `packages/test-runner/src/bench/run-bench.ts`
- `packages/test-runner/src/bench/report-store.ts`
- `packages/test-runner/src/bench/load-report.ts`
- `packages/test-runner/src/bench/read-run-bundle.ts`
- `packages/test-runner/src/bench/evaluate-run.ts`
- `packages/test-runner/src/bench/expand-corpus.ts`
- `packages/test-runner/src/bench/corpus/bench-corpus.ts`
- `packages/test-runner/src/bench/corpus/find-bench-corpus.ts`
- `packages/test-runner/src/bench/tests/run-bench.test.ts`
- `packages/test-runner/src/bench/tests/week1-corpus.test.ts`
- `packages/test-runner/src/bench/tests/compare-reports.test.ts`
- `packages/test-runner/src/run-scenario.ts` (option/result and finalization
  sections only)

No source, shared working document, Core file, run artifact, commit, or push was
changed. No tests or Lab commands were run; this brief requested a read-only
contract.
