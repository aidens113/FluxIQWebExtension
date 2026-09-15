# bq-sharded-final-2-a: terminal verification of Week 1 campaign A

Campaign `bench-mu202a52-127f75c3`, root
`F:\fxlab-runs\sharded-final-2\a\bench\bench-mu202a52-127f75c3`. This check was read-only.
Nothing under `a` or `b`, and nothing in either repository, was created, modified or deleted.
No event messages, logs, page data, environment values or secrets were read or printed.
Only structural fields, counts and digests were read. Each figure below comes from one pass
(the machine has faulty RAM). No script failed or gave an inconsistent result.

## Outcome

Done. Seven items were checked. Six are clean. One contradicts the brief:

- **Contradiction:** the brief expects 18 planned skips, but I observed **12**. The plan has
  201 cells, not 207.
- **Flag:** W28's typed `facilityFailure.reason` is `unclassified`.
- **Gap:** the parent `report.json` has no field for three of the requested figures:
  - leak/redaction attestation findings
  - recording-persistence failures
  - maximum packet bytes

  I took the attestation and maximum-packet figures from per-run files instead, labelled
  below. I found no field for recording-persistence failures anywhere.

Identity checks:
- Facility commit `3d6ecd645e92f1899853e6cbf54f9cbb5ea136da` and Core commit
  `19468b72c4472fd5cc58940737702d5e4d72c985`, which match `3d6ecd6` / `19468b7`.
- `execution` is `shard-parent`, `result-round-robin-v1`, `shardCount 3`, `jobs 2`.
- `request` is repeat 3, target `isolated`, evidence `failure`.

## What changed and why

Nothing in the campaign or the repositories. The only file created is this report.

## 1. Plan coverage

- **Evaluated 189/189 plus 12 planned skips.**
  - Parent `campaign.json` plan: 201 cells, 201 unique `cellKey`s, all `resolved: true`.
  - 189 cells have `skipReason: null`. 12 are skipped, all in the flow lane: 6 because the
    recording script has only `extract, checkpoint` operations, and 6 because it has only
    `extract`.
  - **This contradicts the brief's 18.** 189 + 12 = 201 cells.
- Parent `runs.json`: 201 rows, 189 `evaluated` and 12 `skipped`. All 189 evaluated runIds are
  unique and all appear in the parent terminal checkpoint.
- Parent `report.json`: 63 workflows. Recording lane total 69 and flow lane total 120, which
  add up to 189.
- Shard plans are 69/66/66 cells (201 in all), with 3/6/3 skips. Every shard plan key is in
  the parent plan.
- Shard terminal `completed` has 66/60/63 entries, each unique. No completed key is outside
  its shard plan, and every non-skipped shard cell is completed.
- Across shards, 189 distinct keys were completed: **0 duplicates, 0 missing, 0 extra** against
  the parent's 189 evaluable keys. The parent terminal checkpoint also holds those 189 keys,
  unique, with none missing.

## 2. Checkpoint chains

| Chain | Generations | Terminal state | activeAttempt | completed | Non-generation files | Issues |
| --- | --- | --- | --- | --- | --- | --- |
| parent | 3 (0..2): running, aggregating, finished | finished | null | 189 | 0 | 0 |
| shard 000 `bench-shard0-bea29d18` | 134 (0..133) | finished | null | 66 | 0 | 0 |
| shard 001 `bench-shard1-9c95f372` | 122 (0..121) | finished | null | 60 | 0 | 0 |
| shard 002 `bench-shard2-5033ff80` | 128 (0..127) | finished | null | 63 | 0 | 0 |

These properties held for every generation of all four chains:
- Filename index = `generation` field = position in the chain.
- Generation 0 has `previousSha256: null`. Every later generation's `previousSha256` equals
  the prior generation's `checkpointSha256`.
- `completed` never shrinks.
- `finished` appears only at the last generation.
- A single `campaignId` and a single `planSha256` per chain.

Shard state counts are running 132/120/126, with one `aggregating` and one `finished` each.
For the terminal checkpoints, `checkpointSha256` also recomputes as sorted-key JSON of the
checkpoint without that field.

## 3. Evaluation parity

- Parent `evaluations/` holds 189 files, and no file lacks a matching completed runId. Every
  entry has exactly one file, at `evaluations/<runId>.json`.
- SHA-256 of the file bytes equals `evaluationSha256` in **189/189** entries.
- Shard `evaluations/` hold 66/60/63 files, with no stray files and one file per runId. Every
  shard digest matches, and each shard entry's `cellKey` and `evaluationSha256` equal the
  parent's.
- The shard copies are byte-identical to the parent copies in **189/189** entries.
- Bundles: `a\` contains 191 directories: `bench`, `.work`, and 189 run bundles. No bundle
  directory lacks a matching completed runId.
  - `bundle.complete.json` is present in **189/189**.
  - `bench-receipt.json` matches in **189/189**:
    - `campaignId` equals the shard campaign's `benchId` and the shard checkpoint `campaignId`.
    - `cellKey` equals the checkpoint entry.
    - `runId` equals the entry.
    - `planSha256` equals the shard plan.
  - Checkpoint entries do not carry `cellIdentity` or `attempt`, so I checked those two
    fields another way:
    - `cellIdentity` equals the parent plan cell for that `cellKey`.
    - `attempt` equals the runId's `-aN` suffix, which is 1 for all 189 runs.
  - `evaluation.json` is byte-identical to the campaign copy in **189/189**.
- Problems found: 0.

## 4. Merge seal

**All 24 digests match. There are 0 mismatches.**

| Digest | How recomputed | Result |
| --- | --- | --- |
| `parentPlanSha256` 48ffcbcf… | sorted-key JSON of parent `campaign.json` `.plan`; also equals its `planSha256` field | match |
| `parentManifestSha256` b1b5e8a9… | sorted-key JSON of the whole parent `campaign.json` | match |
| child 0/1/2 `campaignId` | shard `campaign.json` `benchId` and checkpoint `campaignId` | match x3 |
| child 0/1/2 `terminalCheckpointSha256` | terminal checkpoint's `checkpointSha256` field; recomputed as sorted-key JSON without that field | match x3 |
| child 0/1/2 `runsSha256` | raw bytes of `shards/00N/runs.json` | match x3 |
| child 0/1/2 `reportSha256` | raw bytes of `shards/00N/report.json` | match x3 |
| child 0/1/2 `markdownSha256` | raw bytes of `shards/00N/report.md` | match x3 |
| child 0/1/2 `planSha256` | sorted-key JSON of the shard plan; also equals its `planSha256` field and checkpoint `planSha256` | match x3 |
| child 0/1/2 `manifestSha256` | sorted-key JSON of the whole shard `campaign.json` | match x3 |
| `merged.runsSha256` cc2f0251… | raw bytes of parent `runs.json` | match |
| `merged.reportSha256` f6947d1d… | raw bytes of parent `report.json` | match |
| `merged.markdownSha256` 885cf5f7… | raw bytes of parent `report.md` | match |
| `sealSha256` 3ba925a7… | sorted-key JSON of `merge-seal.json` without `sealSha256` | match |

The count of 24 is 18 per-child digests (6 × 3), 3 merged, 2 parent and the seal itself. The
campaignId identity checks are separate.

Hashing the raw bytes of `campaign.json` and checkpoint files does **not** match. This is
expected, because those digests use the canonical sorted-key form. I found the canonical form
by trying candidates until one matched. I did not confirm it from source: I ran one filename
grep, which located `packages\test-runner\src\bench\campaign\shard-group-store.ts`, but did not
open the file. Each child's `execution.parentPlanSha256` equals the parent plan digest.

## 5. Residue

- **Lease files: 0** anywhere under `a`. The four `lease-history` directories (parent and
  three shards) contain 0 files each. There are 0 `*.lock` files.
- **`.staging-*` or `interrupted` directories: 0.** Files named `*.partial` or
  `*.incomplete`: 0.
- **`.tmp` files: 0**, in `evaluations/` and `checkpoints/` and anywhere else under `a`.
- **`a\.work`** exists and is **empty**: 0 entries, 0 files, 0 subdirectories.

## 6. Outcomes

Verdict counts from parent `runs.json`: passed 179, failed 10, skipped 12 (skipped rows have no
verdict).

Failed runs:

| Row | Scenario / variant | Lane | Repeat | runId | failureCategory | facilityFailure | Plan expectedFailure |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W05 | product-catalog / short-catalog | flow | 0 | bench-shard2-5033ff80-c9-a1 | runtime.behavior | null | null |
| W05 | product-catalog / short-catalog | flow | 1 | bench-shard2-5033ff80-c10-a1 | runtime.behavior | null | null |
| W05 | product-catalog / short-catalog | flow | 2 | bench-shard2-5033ff80-c11-a1 | runtime.behavior | null | null |
| W13 | modal-flows / banner-absent | flow | 0 | bench-shard2-5033ff80-c30-a1 | runtime.behavior | null | null |
| W13 | modal-flows / banner-absent | flow | 1 | bench-shard2-5033ff80-c31-a1 | runtime.behavior | null | null |
| W13 | modal-flows / banner-absent | flow | 2 | bench-shard2-5033ff80-c32-a1 | runtime.behavior | null | null |
| W24 | intermediate-state / unannounced | flow | 0 | bench-shard1-9c95f372-c51-a1 | runtime.behavior | null | output_not_observed |
| W24 | intermediate-state / unannounced | flow | 1 | bench-shard1-9c95f372-c52-a1 | runtime.behavior | null | output_not_observed |
| W24 | intermediate-state / unannounced | flow | 2 | bench-shard1-9c95f372-c53-a1 | runtime.behavior | null | output_not_observed |
| W28 | iframe-checkout / (none) | recording | 1 | bench-shard1-9c95f372-c64-a1 | gateway.connection | boundary `finalized-bundle`, stage `scenario.execute`, reason `unclassified` | null |

The failed set is exactly the expected ten: 3 each for W05 `short-catalog`, W13
`banner-absent` and W24 `unannounced`, plus W28 `iframe-checkout` recording repeat 1
`gateway.connection`. No other run failed. Only one run has a non-null `facilityFailure`.

Flags:
- **W28 `facilityFailure.reason` is `unclassified`.** The failure is typed at the
  `finalized-bundle` boundary and `scenario.execute` stage, but its reason is not narrowed
  beyond `unclassified`.
- The nine variant failures have `facilityFailure: null` and `failureCategory`
  `runtime.behavior`. Their rows do not record whether they were ruled out as defects, so I
  checked only that they are the expected cells.
- For information: 30 passed runs sit in plan cells with a non-null `expectedFailure`. The
  report shows flow-lane `failureClassificationAccuracy` as 30/33. I did not investigate
  further.

## 7. Parent report.json figures

- **Harness activations:** recording 0/69 (23 workflows), flow 0/120 (40 workflows), both
  rate 0. Summed across the 189 evaluation files: 0.
- **Leak/redaction attestation findings:** **no such field in `report.json`.**
  `harnessRecovery` and `adaptationPersistence` are both null there. From the bundles:
  - `snapshots/redaction-attestation.json` is present in 189/189, with status
    `not-applicable` 180 and `passed` 9.
  - `findingCount` sums to **0**. The `findings` arrays total 0 and `advisories` total 0.
  - `run.json` `redactionState` is `not_applicable` 180 and `verified` 9.
- **Recording-persistence failures:** **no such field in `report.json`.** No key matching
  `persist` exists in any bundle's `run.json`, `summary.json`, `artifact-index.json` or
  `evidence-policy.json`. I cannot report this figure as a typed metric. The closest structural
  evidence is 189/189 bundles with `bundle.complete.json` and a matching evaluation.
- **Evidence packet bytes** (`sanitizedPacketBytes`): 618 samples, p50 4069, **p95 5934**.
  - **The maximum is not in `report.json`.** From the 189 evaluation files the maximum is
    **5992** and the minimum 528.
  - Recomputing percentiles by nearest rank gives the same p50 and p95.
  - All 618 samples come from the flow lane; the recording lane has 0.
- **Truncation count:** 167, all in the flow lane. The evaluation files also sum to 167.
- **Run duration:** 189 samples, **p50 93100 ms, p95 113134 ms**. Recomputing by nearest rank
  gives the same values; the maximum is 133187 ms.
- Other: `notExecutedRuns` 54, `actionsExecuted` 339, `llm` disabled with 0 calls,
  `rawSnapshotBytes` 0 samples.

## Commands run and observed results

All commands ran as read-only `node -e` scripts and `find`/`ls`/`grep` over
`F:\fxlab-runs\sharded-final-2\a`, from the Bash tool. Each produced the figures above.
- Chain script: 0 issues on all four chains.
- Coverage script: 0 duplicates, 0 missing, 0 extra.
- Parity script: `issues 0 []`, 189 in every check.
- Seal script: 24 matches.
- Residue `find`: every count 0; `.work` has 0 entries.
- One read-only Grep over the repository for `sealSha256|manifestSha256`: 2 files, not opened.
- No `pnpm`, build or test commands were run.

## Not verified

- Self-digests of intermediate (non-terminal) checkpoints. I checked their chain links but
  recomputed self-digests only for the terminal checkpoints.
- The canonical hashing form: inferred by trial, not read from source.
- `bundle.complete.json` `artifactIndexSha256` against `artifact-index.json`.
- Recording-persistence failures as a typed count, because no such field exists.
- Whether the nine variant failures were formally ruled out as defects.
- Any content of the `b` campaign.

## Open questions or contradictions found

1. The brief's plan arithmetic is wrong for campaign A. It says 189 evaluated + 18 skipped =
   207. I observed 189 evaluated + 12 skipped = 201 cells.
2. W28's `facilityFailure.reason` is `unclassified`. Should the verdict gate accept that, or
   should the reason be narrowed?
3. The parent `report.json` has no leak-attestation, recording-persistence or maximum
   packet-size fields. Figures that need those must come from the bundles or evaluations, or
   the report schema needs extending.
